import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Node as NodeModel, Prisma } from '@prisma/client';
import {
  createHash,
  randomBytes,
  randomUUID,
  X509Certificate,
} from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt, encrypt } from '../common/crypto.util';
import { CreateNodeDto } from './dto/create-node.dto';
import { NodesPaginatedQueryDto } from './dto/nodes-paginated-query.dto';
import { RollbackNodeDto } from './dto/rollback-node.dto';
import { PaginatedResult } from '../common/pagination.dto';
import {
  AgentClient,
  AgentClientError,
  AgentHealth,
  AgentNodeCredentials,
} from './agent-client';
import { normalizeAgentHost } from './network-security';

export interface SyncResult {
  nodeId: string;
  success: boolean;
  revision?: string;
  deploymentId?: string;
  error?: string;
}

export interface PublicNode {
  id: string;
  name: string;
  address: string;
  port: number;
  enabled: boolean;
  status: string;
  lastCheck: Date | null;
  createdAt: Date;
  agentKeyId: string;
  agentApiVersion: string | null;
  agentVersion: string | null;
  lastRevision: string | null;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  credentialsConfigured: boolean;
  customCaConfigured: boolean;
  caFingerprint: string | null;
}

type StoredNode = NodeModel;

@Injectable()
export class NodesService {
  private readonly logger = new Logger(NodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly agentClient: AgentClient,
  ) {}

  async findAll(): Promise<PublicNode[]> {
    const nodes = await this.prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return nodes.map((node) => this.serializeNode(node));
  }

  async findPaginated(
    query: NodesPaginatedQueryDto,
  ): Promise<PaginatedResult<PublicNode>> {
    const start = query.start ?? 0;
    const size = query.size ?? 25;
    const sortOrder: 'asc' | 'desc' = query.sortOrder ?? 'desc';
    const sortableFields = new Set([
      'createdAt',
      'name',
      'status',
      'lastCheck',
      'lastSyncAt',
    ]);
    const sortBy =
      query.sortBy && sortableFields.has(query.sortBy)
        ? query.sortBy
        : 'createdAt';

    const andConditions: Prisma.NodeWhereInput[] = [];
    if (query.enabled !== undefined) {
      andConditions.push({ enabled: query.enabled });
    }
    if (query.status !== undefined) {
      andConditions.push({ status: query.status });
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      andConditions.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { address: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.NodeWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};
    const orderBy = {
      [sortBy]: sortOrder,
    } as Prisma.NodeOrderByWithRelationInput;

    const [total, nodes] = await this.prisma.$transaction([
      this.prisma.node.count({ where }),
      this.prisma.node.findMany({
        where,
        orderBy,
        skip: start,
        take: size,
      }),
    ]);

    return {
      items: nodes.map((node) => this.serializeNode(node)),
      total,
      start,
      size,
    };
  }

  async create(dto: CreateNodeDto): Promise<PublicNode> {
    const address = normalizeAgentHost(dto.address);
    const serverName = dto.serverName
      ? normalizeAgentHost(dto.serverName)
      : null;
    const secretEnc = encrypt(dto.apiKey);
    const candidate: AgentNodeCredentials = {
      id: 'pending-node-registration',
      address,
      port: dto.port,
      apiKey: '',
      agentKeyId: dto.keyId,
      agentSecretEnc: secretEnc,
      agentCaCert: dto.caCertificate?.trim() || null,
      agentServerName: serverName,
    };

    let version: { api_version: string; version: string };
    let health: AgentHealth;
    try {
      version = await this.agentClient.version(candidate);
      health = await this.agentClient.health(candidate);
    } catch (error) {
      throw this.toHttpException(error);
    }

    const created = await this.prisma.node.create({
      data: {
        name: dto.name.trim(),
        address,
        port: dto.port,
        apiKey: '',
        agentKeyId: dto.keyId,
        agentSecretEnc: secretEnc,
        agentCaCert: dto.caCertificate?.trim() || null,
        agentServerName: serverName,
        agentApiVersion: version.api_version,
        agentVersion: version.version,
        enabled: dto.enabled ?? true,
        status: health.status === 'ok' && health.xray?.active
          ? 'healthy'
          : 'degraded',
        lastCheck: new Date(),
        lastRevision: health.revision?.id ?? null,
      },
    });
    return this.serializeNode(created);
  }

  async remove(id: string): Promise<{ message: string }> {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('Node not found');
    await this.prisma.node.delete({ where: { id } });
    return { message: 'Node deleted' };
  }

  async checkHealth(id: string): Promise<PublicNode & { health: AgentHealth }> {
    const node = await this.getStoredNode(id);
    try {
      const health = await this.agentClient.health(
        await this.credentials(node),
      );
      const status = health.status === 'ok' && health.xray?.active
        ? 'healthy'
        : 'degraded';
      const updated = await this.prisma.node.update({
        where: { id },
        data: {
          status,
          lastCheck: new Date(),
          agentApiVersion: health.api_version,
          agentVersion: health.version,
          lastRevision: health.revision?.id ?? node.lastRevision,
          lastSyncError: status === 'healthy'
            ? null
            : 'Agent or Xray reported degraded health',
        },
      });
      this.emitStatusChange(node, updated);
      return { ...this.serializeNode(updated), health };
    } catch (error) {
      const message = this.errorMessage(error);
      const status = error instanceof AgentClientError &&
        error.code === 'agent_connection_failed'
        ? 'offline'
        : 'error';
      const updated = await this.prisma.node.update({
        where: { id },
        data: {
          status,
          lastCheck: new Date(),
          lastSyncError: message,
        },
      });
      this.emitStatusChange(node, updated);
      throw this.toHttpException(error);
    }
  }

  async checkAllHealth(): Promise<
    Array<{ nodeId: string; status: string; success: boolean; error?: string }>
  > {
    const nodes = await this.prisma.node.findMany();
    const results: Array<{
      nodeId: string;
      status: string;
      success: boolean;
      error?: string;
    }> = [];
    const concurrency = 10;
    for (let offset = 0; offset < nodes.length; offset += concurrency) {
      const batch = nodes.slice(offset, offset + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (node) => {
          try {
            const updated = await this.checkHealth(node.id);
            return {
              nodeId: node.id,
              status: updated.status,
              success: true,
            };
          } catch (error) {
            return {
              nodeId: node.id,
              status: 'error',
              success: false,
              error: this.errorMessage(error),
            };
          }
        }),
      );
      results.push(...batchResults);
    }
    return results;
  }

  async pushConfigToAll(
    config: string,
    initiatedBy?: string,
  ): Promise<SyncResult[]> {
    const parsed = this.parseConfig(config);
    const canonical = JSON.stringify(parsed);
    const hash = createHash('sha256').update(canonical).digest('hex');
    const nodes = await this.prisma.node.findMany({
      where: { enabled: true },
    });

    return Promise.all(
      nodes.map((node) =>
        this.syncNode(node, parsed, hash, initiatedBy),
      ),
    );
  }

  async restart(
    id: string,
  ): Promise<{ node: PublicNode; xray: unknown }> {
    const node = await this.getStoredNode(id);
    try {
      const result = await this.agentClient.restart(
        await this.credentials(node),
        `restart:${node.id}:${randomUUID()}`,
      );
      const updated = await this.prisma.node.update({
        where: { id },
        data: {
          status: result.xray.active ? 'healthy' : 'degraded',
          lastCheck: new Date(),
          lastSyncAt: new Date(),
          lastSyncError: null,
          lastRevision: result.revision?.id ?? node.lastRevision,
        },
      });
      return { node: this.serializeNode(updated), xray: result.xray };
    } catch (error) {
      await this.markNodeFailure(node, error);
      throw this.toHttpException(error);
    }
  }

  async rollback(
    id: string,
    dto: RollbackNodeDto,
  ): Promise<{ node: PublicNode; revision: unknown }> {
    const node = await this.getStoredNode(id);
    try {
      const result = await this.agentClient.rollback(
        await this.credentials(node),
        dto.revision,
        dto.reason ?? 'Panel operator rollback',
        `rollback:${node.id}:${randomUUID()}`,
      );
      const updated = await this.prisma.node.update({
        where: { id },
        data: {
          status: 'healthy',
          lastCheck: new Date(),
          lastSyncAt: new Date(),
          lastSyncError: null,
          lastRevision: result.revision.id,
        },
      });
      return { node: this.serializeNode(updated), revision: result.revision };
    } catch (error) {
      await this.markNodeFailure(node, error);
      throw this.toHttpException(error);
    }
  }

  async rotateKey(
    id: string,
  ): Promise<{ node: PublicNode; graceSeconds: number }> {
    const node = await this.getStoredNode(id);
    const credentials = await this.credentials(node);
    const secret = randomBytes(32).toString('base64');
    const keyId = `panel-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
    const graceSeconds = 300;
    try {
      await this.agentClient.rotateKey(
        credentials,
        keyId,
        secret,
        graceSeconds,
        `rotate:${node.id}:${randomUUID()}`,
      );
      const candidate: AgentNodeCredentials = {
        ...credentials,
        agentKeyId: keyId,
        agentSecretEnc: encrypt(secret),
        apiKey: '',
      };
      await this.agentClient.health(candidate);
      const updated = await this.prisma.node.update({
        where: { id },
        data: {
          apiKey: '',
          agentKeyId: keyId,
          agentSecretEnc: candidate.agentSecretEnc,
          status: 'healthy',
          lastCheck: new Date(),
          lastSyncError: null,
        },
      });
      return { node: this.serializeNode(updated), graceSeconds };
    } catch (error) {
      await this.markNodeFailure(node, error);
      throw this.toHttpException(error);
    }
  }

  async listDeployments(id: string) {
    await this.getStoredNode(id);
    return this.prisma.nodeDeployment.findMany({
      where: { nodeId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async syncNode(
    node: StoredNode,
    config: unknown,
    hash: string,
    initiatedBy?: string,
  ): Promise<SyncResult> {
    const idempotencyKey = `cfg:${node.id}:${hash}`;
    const deployment = await this.getOrCreateDeployment(
      node.id,
      idempotencyKey,
      hash,
      initiatedBy,
    );
    if (deployment.status === 'succeeded') {
      return {
        nodeId: node.id,
        success: true,
        revision: deployment.revision ?? undefined,
        deploymentId: deployment.id,
      };
    }

    try {
      const credentials = await this.credentials(node);
      const validation = await this.agentClient.validate(credentials, config);
      if (!validation.valid || validation.hash !== hash) {
        throw new AgentClientError(
          'Agent validation hash does not match desired configuration',
          409,
          'agent_config_hash_mismatch',
          undefined,
          { expected: hash, received: validation.hash },
        );
      }
      const applied = await this.agentClient.apply(
        credentials,
        config,
        `Panel deployment ${deployment.id}`,
        idempotencyKey,
      );
      await this.prisma.$transaction([
        this.prisma.nodeDeployment.update({
          where: { id: deployment.id },
          data: {
            status: 'succeeded',
            revision: applied.revision.id,
            error: null,
            finishedAt: new Date(),
          },
        }),
        this.prisma.node.update({
          where: { id: node.id },
          data: {
            status: 'healthy',
            lastCheck: new Date(),
            lastSyncAt: new Date(),
            lastSyncError: null,
            lastRevision: applied.revision.id,
          },
        }),
      ]);
      return {
        nodeId: node.id,
        success: true,
        revision: applied.revision.id,
        deploymentId: deployment.id,
      };
    } catch (error) {
      const message = this.errorMessage(error);
      await this.prisma.$transaction([
        this.prisma.nodeDeployment.update({
          where: { id: deployment.id },
          data: {
            status: 'failed',
            error: message.slice(0, 2000),
            finishedAt: new Date(),
          },
        }),
        this.prisma.node.update({
          where: { id: node.id },
          data: {
            status: 'error',
            lastCheck: new Date(),
            lastSyncAt: new Date(),
            lastSyncError: message.slice(0, 2000),
          },
        }),
      ]).catch(() => undefined);
      this.logger.warn(
        `Agent config deployment failed for ${node.name} (${node.id}): ${message}`,
      );
      return {
        nodeId: node.id,
        success: false,
        deploymentId: deployment.id,
        error: message,
      };
    }
  }

  private async getOrCreateDeployment(
    nodeId: string,
    idempotencyKey: string,
    configHash: string,
    initiatedBy?: string,
  ) {
    const existing = await this.prisma.nodeDeployment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;

    try {
      return await this.prisma.nodeDeployment.create({
        data: {
          nodeId,
          idempotencyKey,
          configHash,
          initiatedBy,
          status: 'pending',
        },
      });
    } catch (error) {
      // Parallel requests for the same desired config are expected to race on
      // the unique idempotency key. Re-read the winner instead of reporting a
      // false deployment failure.
      if (this.isUniqueConstraintError(error)) {
        const concurrent = await this.prisma.nodeDeployment.findUnique({
          where: { idempotencyKey },
        });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) || (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  private parseConfig(config: string): unknown {
    try {
      const parsed = JSON.parse(config) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('root must be an object');
      }
      return parsed;
    } catch (error) {
      throw new HttpException(
        {
          statusCode: 400,
          code: 'invalid_xray_config',
          message: 'Xray configuration must be a JSON object',
        },
        400,
        { cause: error },
      );
    }
  }

  private async getStoredNode(id: string): Promise<StoredNode> {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('Node not found');
    return node;
  }

  private async credentials(node: StoredNode): Promise<AgentNodeCredentials> {
    let secretEnc = node.agentSecretEnc;
    if (!secretEnc && node.apiKey) {
      secretEnc = encrypt(node.apiKey);
      await this.prisma.node.update({
        where: { id: node.id },
        data: { agentSecretEnc: secretEnc, apiKey: '' },
      });
    }
    return {
      id: node.id,
      address: node.address,
      port: node.port,
      apiKey: '',
      agentKeyId: node.agentKeyId,
      agentSecretEnc: secretEnc,
      agentCaCert: node.agentCaCert,
      agentServerName: node.agentServerName,
    };
  }

  private serializeNode(node: StoredNode): PublicNode {
    return {
      id: node.id,
      name: node.name,
      address: node.address,
      port: node.port,
      enabled: node.enabled,
      status: node.status,
      lastCheck: node.lastCheck,
      createdAt: node.createdAt,
      agentKeyId: node.agentKeyId,
      agentApiVersion: node.agentApiVersion,
      agentVersion: node.agentVersion,
      lastRevision: node.lastRevision,
      lastSyncAt: node.lastSyncAt,
      lastSyncError: node.lastSyncError,
      credentialsConfigured: Boolean(
        node.agentKeyId && (node.agentSecretEnc || node.apiKey),
      ),
      customCaConfigured: Boolean(node.agentCaCert),
      caFingerprint: this.caFingerprint(node.agentCaCert),
    };
  }

  private caFingerprint(certificate: string | null): string | null {
    if (!certificate) return null;
    try {
      return new X509Certificate(certificate).fingerprint256;
    } catch {
      return null;
    }
  }

  private emitStatusChange(previous: StoredNode, updated: StoredNode): void {
    const wasHealthy = previous.status === 'healthy';
    const isHealthy = updated.status === 'healthy';
    if (wasHealthy && !isHealthy) {
      this.eventEmitter.emit('node.down', {
        id: updated.id,
        name: updated.name,
        address: updated.address,
        status: updated.status,
      });
    } else if (!wasHealthy && isHealthy) {
      this.eventEmitter.emit('node.up', {
        id: updated.id,
        name: updated.name,
        address: updated.address,
        status: updated.status,
      });
    }
  }

  private async markNodeFailure(
    node: StoredNode,
    error: unknown,
  ): Promise<void> {
    const message = this.errorMessage(error);
    await this.prisma.node
      .update({
        where: { id: node.id },
        data: {
          status: 'error',
          lastCheck: new Date(),
          lastSyncError: message.slice(0, 2000),
        },
      })
      .catch(() => undefined);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof AgentClientError) return error.message;
    if (error instanceof HttpException) return error.message;
    return error instanceof Error ? error.message : String(error);
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    if (error instanceof AgentClientError) {
      return new HttpException(
        {
          statusCode: error.statusCode,
          code: error.code,
          message: error.message,
          requestId: error.requestId,
          details: error.details,
        },
        error.statusCode,
        { cause: error },
      );
    }
    return new HttpException(
      {
        statusCode: 502,
        code: 'agent_request_failed',
        message: 'Agent request failed',
      },
      502,
      { cause: error },
    );
  }
}
