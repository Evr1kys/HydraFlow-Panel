import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Node as NodeModel, Prisma } from '@prisma/client';
import * as net from 'net';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { NodesPaginatedQueryDto } from './dto/nodes-paginated-query.dto';
import { PaginatedResult } from '../common/pagination.dto';

export interface SyncResult {
  nodeId: string;
  success: boolean;
  error?: string;
}

export interface NodeRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

interface NodeLike {
  address: string;
  port: number;
  apiKey: string;
}

@Injectable()
export class NodesService {
  private readonly logger = new Logger(NodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll() {
    return this.prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPaginated(
    query: NodesPaginatedQueryDto,
  ): Promise<PaginatedResult<NodeModel>> {
    const start = query.start ?? 0;
    const size = query.size ?? 25;
    const sortOrder: 'asc' | 'desc' = query.sortOrder ?? 'desc';

    const sortableFields = new Set([
      'createdAt',
      'name',
      'status',
      'lastCheck',
    ]);
    const sortBy =
      query.sortBy && sortableFields.has(query.sortBy)
        ? query.sortBy
        : 'createdAt';

    const where: Prisma.NodeWhereInput = {};
    const andConditions: Prisma.NodeWhereInput[] = [];

    if (query.enabled !== undefined) {
      andConditions.push({ enabled: query.enabled });
    }
    if (query.status !== undefined) {
      andConditions.push({ status: query.status });
    }
    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      andConditions.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { address: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const orderBy: Prisma.NodeOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    } as Prisma.NodeOrderByWithRelationInput;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.node.count({ where }),
      this.prisma.node.findMany({
        where,
        orderBy,
        skip: start,
        take: size,
      }),
    ]);

    return {
      items,
      total,
      start,
      size,
    };
  }

  async create(dto: CreateNodeDto) {
    return this.prisma.node.create({
      data: {
        name: dto.name,
        address: dto.address,
        port: dto.port,
        apiKey: dto.apiKey ?? '',
        enabled: dto.enabled ?? true,
      },
    });
  }

  async remove(id: string) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }
    await this.prisma.node.delete({ where: { id } });
    return { message: 'Node deleted' };
  }

  /**
   * Low-level helper: perform an authenticated HTTPS request against a node agent.
   * Uses a self-signed-cert-friendly agent unless NODE_CA_CERT_PATH is set.
   */
  async nodeRequest<T = unknown>(
    node: NodeLike,
    options: NodeRequestOptions,
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const timeoutMs = options.timeoutMs ?? 30_000;
    const url = `https://${node.address}:${node.port}${options.path}`;

    const agent = this.buildHttpsAgent();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${node.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        // @ts-expect-error - Node's undici fetch honours `dispatcher`/`agent` at runtime
        agent,
      });

      const text = await res.text();
      let parsed: unknown = text;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      if (!res.ok) {
        const message =
          typeof parsed === 'object' && parsed && 'message' in parsed
            ? String((parsed as { message: unknown }).message)
            : `Node request failed with status ${res.status}`;
        throw new HttpException(
          { statusCode: res.status, message, nodeResponse: parsed },
          res.status,
        );
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if ((err as { name?: string }).name === 'AbortError') {
        throw new HttpException(
          `Node request timed out after ${timeoutMs}ms`,
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        `Node request failed: ${message}`,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private buildHttpsAgent(): https.Agent {
    const caPath = process.env.NODE_CA_CERT_PATH;
    if (caPath) {
      try {
        // require('fs') synchronously to keep this simple; agent is cheap
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs') as typeof import('fs');
        const ca = fs.readFileSync(caPath);
        return new https.Agent({ ca, rejectUnauthorized: true });
      } catch (err) {
        this.logger.warn(
          `Could not read NODE_CA_CERT_PATH (${caPath}): ${
            err instanceof Error ? err.message : String(err)
          }. Falling back to insecure agent.`,
        );
      }
    }
    return new https.Agent({ rejectUnauthorized: false });
  }

  /**
   * Push the given xray config JSON to every enabled node in parallel.
   * Updates each node's status/lastCheck based on success.
   */
  async pushConfigToAll(config: string): Promise<SyncResult[]> {
    const nodes = await this.prisma.node.findMany({
      where: { enabled: true },
    });

    const results = await Promise.all(
      nodes.map(async (node): Promise<SyncResult> => {
        try {
          await this.nodeRequest(node, {
            method: 'POST',
            path: '/api/xray/config',
            body: { config },
            timeoutMs: 30_000,
          });
          await this.prisma.node.update({
            where: { id: node.id },
            data: { status: 'healthy', lastCheck: new Date() },
          });
          return { nodeId: node.id, success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to push xray config to node ${node.name} (${node.id}): ${message}`,
          );
          await this.prisma.node
            .update({
              where: { id: node.id },
              data: { status: 'error', lastCheck: new Date() },
            })
            .catch(() => undefined);
          return { nodeId: node.id, success: false, error: message };
        }
      }),
    );

    return results;
  }

  /**
   * Query the remote node's /api/health endpoint, update DB status.
   */
  async checkHealth(id: string) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('Node not found');
    }

    let status = 'error';
    let healthPayload: unknown = null;
    try {
      healthPayload = await this.nodeRequest(node, {
        method: 'GET',
        path: '/api/health',
        timeoutMs: 10_000,
      });
      status = 'healthy';
    } catch (err) {
      // Fallback: if HTTPS agent not reachable, try TCP probe so we report offline vs error
      const reachable = await this.tcpCheck(node.address, node.port);
      status = reachable ? 'error' : 'offline';
      this.logger.warn(
        `Health check failed for node ${node.name} (${node.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const updated = await this.prisma.node.update({
      where: { id },
      data: {
        status,
        lastCheck: new Date(),
      },
    });

    const prevStatus = node.status;
    const wasHealthy = prevStatus === 'healthy';
    const isHealthy = status === 'healthy';
    if (wasHealthy && !isHealthy) {
      this.eventEmitter.emit('node.down', {
        id: updated.id,
        name: updated.name,
        address: updated.address,
        status,
      });
    } else if (!wasHealthy && isHealthy) {
      this.eventEmitter.emit('node.up', {
        id: updated.id,
        name: updated.name,
        address: updated.address,
        status,
      });
    }

    return { ...updated, health: healthPayload };
  }

  /**
   * Run checkHealth against every node in parallel.
   */
  async checkAllHealth() {
    const nodes = await this.prisma.node.findMany();
    const results = await Promise.all(
      nodes.map(async (node) => {
        try {
          const updated = await this.checkHealth(node.id);
          return { nodeId: node.id, status: updated.status, success: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { nodeId: node.id, status: 'error', success: false, error: message };
        }
      }),
    );
    return results;
  }

  private tcpCheck(host: string, port: number, timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }
}
