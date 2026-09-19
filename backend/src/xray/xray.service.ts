import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { NodesService, SyncResult } from '../nodes/nodes.service';

export interface XrayStatus {
  running: boolean;
  version: string | null;
  uptime: string | null;
  nodes: Array<{
    id: string;
    name: string;
    status: string;
    version: string | null;
    revision: string | null;
    lastCheck: Date | null;
  }>;
}

export interface XrayInbound {
  listen: string;
  port: number;
  protocol: string;
  settings: Record<string, unknown>;
  streamSettings?: Record<string, unknown>;
  tag: string;
}

export interface XrayConfig {
  log: { loglevel: string };
  api: { tag: string; services: string[] };
  policy: Record<string, unknown>;
  inbounds: XrayInbound[];
  outbounds: Array<{ protocol: string; tag: string }>;
  routing: Record<string, unknown>;
}

export interface ConfigValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationError[];
}

@Injectable()
export class XrayService {
  private readonly logger = new Logger(XrayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly nodes: NodesService,
  ) {}

  async getStatus(): Promise<XrayStatus> {
    await this.nodes.checkAllHealth();
    const nodes = await this.nodes.findAll();
    const enabled = nodes.filter((node) => node.enabled);
    const healthy = enabled.filter((node) => node.status === 'healthy');
    return {
      running: enabled.length > 0 && healthy.length === enabled.length,
      version: healthy[0]?.agentVersion ?? null,
      uptime: null,
      nodes: enabled.map((node) => ({
        id: node.id,
        name: node.name,
        status: node.status,
        version: node.agentVersion,
        revision: node.lastRevision,
        lastCheck: node.lastCheck,
      })),
    };
  }

  async restart(): Promise<{
    message: string;
    results: Array<{ nodeId: string; success: boolean; error?: string }>;
  }> {
    const enabled = (await this.nodes.findAll()).filter((node) => node.enabled);
    if (enabled.length === 0) {
      throw new BadRequestException('No enabled HydraFlow Agent nodes');
    }
    const results = await Promise.all(
      enabled.map(async (node) => {
        try {
          await this.nodes.restart(node.id);
          return { nodeId: node.id, success: true };
        } catch (error) {
          return {
            nodeId: node.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
    const failures = results.filter((result) => !result.success);
    if (failures.length > 0) {
      throw new HttpException(
        {
          statusCode: 502,
          code: 'agent_restart_partial_failure',
          message: 'One or more Agents failed to restart Xray',
          results,
        },
        502,
      );
    }
    return { message: 'Xray restarted on all enabled Agents', results };
  }

  async generateConfig(): Promise<XrayConfig> {
    const startTime = process.hrtime.bigint();
    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });
    if (!settings) {
      throw new UnprocessableEntityException('HydraFlow settings are missing');
    }
    const users = await this.prisma.user.findMany({
      where: {
        enabled: true,
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
    });

    const inbounds: XrayInbound[] = [
      {
        listen: '127.0.0.1',
        port: 10085,
        protocol: 'dokodemo-door',
        settings: { address: '127.0.0.1' },
        tag: 'api',
      },
    ];

    if (settings.realityEnabled) {
      if (!settings.realityPvk || !settings.realitySid) {
        throw new UnprocessableEntityException(
          'Reality is enabled but private key or short ID is missing',
        );
      }
      inbounds.push({
        listen: '0.0.0.0',
        port: settings.realityPort,
        protocol: 'vless',
        settings: {
          clients: users.map((user) => ({
            id: user.uuid,
            email: user.email,
            level: 0,
            flow: 'xtls-rprx-vision',
          })),
          decryption: 'none',
        },
        streamSettings: {
          network: 'tcp',
          security: 'reality',
          realitySettings: {
            show: false,
            dest: `${settings.realitySni}:443`,
            xver: 0,
            serverNames: [settings.realitySni],
            privateKey: settings.realityPvk,
            shortIds: [settings.realitySid],
          },
        },
        tag: 'reality-in',
      });
    }

    if (settings.wsEnabled) {
      inbounds.push({
        listen: '0.0.0.0',
        port: settings.wsPort,
        protocol: 'vless',
        settings: {
          clients: users.map((user) => ({
            id: user.uuid,
            email: user.email,
            level: 0,
          })),
          decryption: 'none',
        },
        streamSettings: {
          network: 'ws',
          wsSettings: {
            path: settings.wsPath ?? '/ws',
            headers: settings.wsHost ? { Host: settings.wsHost } : {},
          },
        },
        tag: 'ws-in',
      });
    }

    if (settings.ssEnabled) {
      if (!settings.ssPassword) {
        throw new UnprocessableEntityException(
          'Shadowsocks is enabled but its password is missing',
        );
      }
      inbounds.push({
        listen: '0.0.0.0',
        port: settings.ssPort,
        protocol: 'shadowsocks',
        settings: {
          method: settings.ssMethod,
          password: settings.ssPassword,
          network: 'tcp,udp',
        },
        tag: 'ss-in',
      });
    }

    const config: XrayConfig = {
      log: { loglevel: 'warning' },
      api: { tag: 'api', services: ['StatsService'] },
      policy: {
        levels: {
          '0': {
            statsUserUplink: true,
            statsUserDownlink: true,
          },
        },
        system: {
          statsInboundUplink: true,
          statsInboundDownlink: true,
          statsOutboundUplink: true,
          statsOutboundDownlink: true,
        },
      },
      inbounds,
      outbounds: [
        { protocol: 'freedom', tag: 'direct' },
        { protocol: 'blackhole', tag: 'blocked' },
        { protocol: 'freedom', tag: 'api' },
      ],
      routing: {
        domainStrategy: 'AsIs',
        rules: [
          {
            type: 'field',
            inboundTag: ['api'],
            outboundTag: 'api',
          },
        ],
      },
    };

    const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
    this.metrics.observeConfigGen(durationSeconds);
    return config;
  }

  async getConfig(): Promise<{ config: string }> {
    const config = await this.generateConfig();
    return { config: JSON.stringify(config, null, 2) };
  }

  async saveConfig(
    configJson: string,
    initiatedBy?: string,
  ): Promise<{ message: string; results: SyncResult[] }> {
    const validation = this.validateConfig(configJson);
    if (!validation.valid) {
      throw new BadRequestException({
        code: 'invalid_xray_config',
        message: 'Xray configuration contains structural errors',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }
    const results = await this.nodes.pushConfigToAll(configJson, initiatedBy);
    if (results.length === 0) {
      throw new BadRequestException('No enabled HydraFlow Agent nodes');
    }
    const failures = results.filter((result) => !result.success);
    if (failures.length > 0) {
      this.logger.error(
        `Xray deployment failed on ${failures.length}/${results.length} nodes`,
      );
      throw new HttpException(
        {
          statusCode: 502,
          code: 'xray_deployment_partial_failure',
          message: 'Configuration failed on one or more Agents',
          results,
        },
        502,
      );
    }
    return {
      message: 'Configuration validated and applied on all enabled Agents',
      results,
    };
  }

  async getDefaultConfig(): Promise<{ config: string }> {
    const config = await this.generateConfig();
    return { config: JSON.stringify(config, null, 2) };
  }

  validateConfig(configJson: string): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJson) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new SyntaxError('Config root must be an object');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      const position = message.match(/position\s+(\d+)/i)?.[1];
      let line = 1;
      let column = 1;
      if (position) {
        const offset = Number.parseInt(position, 10);
        const prefix = configJson.substring(0, offset);
        line = (prefix.match(/\n/g) ?? []).length + 1;
        column = offset - prefix.lastIndexOf('\n');
      }
      errors.push({ line, column, message, severity: 'error' });
      return { valid: false, errors, warnings };
    }

    if (parsed['inbounds'] !== undefined && !Array.isArray(parsed['inbounds'])) {
      errors.push({
        line: 1,
        column: 1,
        message: '"inbounds" must be an array',
        severity: 'error',
      });
    }
    if (parsed['outbounds'] !== undefined && !Array.isArray(parsed['outbounds'])) {
      errors.push({
        line: 1,
        column: 1,
        message: '"outbounds" must be an array',
        severity: 'error',
      });
    }

    if (Array.isArray(parsed['inbounds'])) {
      const ports = new Set<number>();
      const tags = new Set<string>();
      for (const [index, value] of parsed['inbounds'].entries()) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          errors.push({
            line: 1,
            column: 1,
            message: `inbounds[${index}] must be an object`,
            severity: 'error',
          });
          continue;
        }
        const inbound = value as Record<string, unknown>;
        if (typeof inbound['protocol'] !== 'string') {
          errors.push({
            line: 1,
            column: 1,
            message: `inbounds[${index}]: missing protocol`,
            severity: 'error',
          });
        }
        if (!Number.isInteger(inbound['port'])) {
          errors.push({
            line: 1,
            column: 1,
            message: `inbounds[${index}]: port must be an integer`,
            severity: 'error',
          });
        } else {
          const port = inbound['port'] as number;
          if (port < 1 || port > 65535) {
            errors.push({
              line: 1,
              column: 1,
              message: `inbounds[${index}]: port is outside 1-65535`,
              severity: 'error',
            });
          }
          if (ports.has(port)) {
            warnings.push({
              line: 1,
              column: 1,
              message: `inbounds[${index}]: duplicate port ${port}`,
              severity: 'warning',
            });
          }
          ports.add(port);
        }
        if (typeof inbound['tag'] === 'string') {
          const tag = inbound['tag'];
          if (tags.has(tag)) {
            errors.push({
              line: 1,
              column: 1,
              message: `inbounds[${index}]: duplicate tag "${tag}"`,
              severity: 'error',
            });
          }
          tags.add(tag);
        }
      }
    }

    if (Array.isArray(parsed['outbounds'])) {
      const outbounds = parsed['outbounds'];
      for (const [index, value] of outbounds.entries()) {
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          typeof (value as Record<string, unknown>)['protocol'] !== 'string'
        ) {
          errors.push({
            line: 1,
            column: 1,
            message: `outbounds[${index}]: missing protocol`,
            severity: 'error',
          });
        }
      }
      if (
        !outbounds.some(
          (value) =>
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            (value as Record<string, unknown>)['protocol'] === 'freedom',
        )
      ) {
        warnings.push({
          line: 1,
          column: 1,
          message: 'No freedom outbound found',
          severity: 'warning',
        });
      }
    }

    if (!Array.isArray(parsed['inbounds']) || parsed['inbounds'].length === 0) {
      warnings.push({
        line: 1,
        column: 1,
        message: 'Configuration has no inbounds',
        severity: 'warning',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
