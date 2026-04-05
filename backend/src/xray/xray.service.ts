import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

const execAsync = promisify(exec);

const XRAY_CONFIG_PATH = '/etc/xray/config.json';

export interface XrayStatus {
  running: boolean;
  version: string | null;
  uptime: string | null;
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
  inbounds: XrayInbound[];
  outbounds: Array<{ protocol: string; tag: string }>;
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
  ) {}

  async getStatus(): Promise<XrayStatus> {
    try {
      const { stdout } = await execAsync('pgrep -x xray');
      const pid = stdout.trim();
      let version: string | null = null;

      try {
        const versionResult = await execAsync('xray version');
        const match = versionResult.stdout.match(/Xray\s+([\d.]+)/);
        version = match ? match[1] : null;
      } catch {
        version = null;
      }

      return {
        running: !!pid,
        version,
        uptime: pid ? 'running' : null,
      };
    } catch {
      return { running: false, version: null, uptime: null };
    }
  }

  async restart(): Promise<{ message: string }> {
    try {
      await this.generateConfig();
      try {
        await execAsync('pkill -x xray');
      } catch {
        // Process may not be running
      }
      await execAsync(
        'xray run -config /etc/xray/config.json > /dev/null 2>&1 &',
      );
      this.logger.log('Xray restarted successfully');
      return { message: 'Xray restarted' };
    } catch (error) {
      this.logger.error('Failed to restart xray', error);
      return { message: 'Xray restart attempted (may not be installed)' };
    }
  }

  async generateConfig(): Promise<XrayConfig> {
    const startTime = process.hrtime.bigint();
    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });
    const users = await this.prisma.user.findMany({
      where: { enabled: true },
    });

    const inbounds: XrayInbound[] = [];

    if (settings?.realityEnabled) {
      inbounds.push({
        listen: '0.0.0.0',
        port: settings.realityPort,
        protocol: 'vless',
        settings: {
          clients: users.map((u) => ({
            id: u.uuid,
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
            privateKey: settings.realityPvk ?? '',
            shortIds: [settings.realitySid ?? ''],
          },
        },
        tag: 'reality-in',
      });
    }

    if (settings?.wsEnabled) {
      inbounds.push({
        listen: '0.0.0.0',
        port: settings.wsPort,
        protocol: 'vless',
        settings: {
          clients: users.map((u) => ({
            id: u.uuid,
          })),
          decryption: 'none',
        },
        streamSettings: {
          network: 'ws',
          wsSettings: {
            path: settings.wsPath ?? '/ws',
            headers: settings.wsHost
              ? { Host: settings.wsHost }
              : {},
          },
        },
        tag: 'ws-in',
      });
    }

    if (settings?.ssEnabled) {
      inbounds.push({
        listen: '0.0.0.0',
        port: settings.ssPort,
        protocol: 'shadowsocks',
        settings: {
          method: settings.ssMethod,
          password: settings.ssPassword ?? '',
          network: 'tcp,udp',
        },
        tag: 'ss-in',
      });
    }

    const config: XrayConfig = {
      log: { loglevel: 'warning' },
      inbounds,
      outbounds: [
        { protocol: 'freedom', tag: 'direct' },
        { protocol: 'blackhole', tag: 'blocked' },
      ],
    };

    try {
      const { writeFile } = await import('fs/promises');
      await writeFile(
        '/etc/xray/config.json',
        JSON.stringify(config, null, 2),
      );
    } catch {
      this.logger.warn('Could not write xray config (not running as root or xray not installed)');
    }

    const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
    this.metrics.observeConfigGen(durationSeconds);

    return config;
  }

  async getConfig(): Promise<{ config: string }> {
    try {
      const content = await readFile(XRAY_CONFIG_PATH, 'utf-8');
      return { config: content };
    } catch {
      // If file doesn't exist, generate default and return it
      const config = await this.generateConfig();
      return { config: JSON.stringify(config, null, 2) };
    }
  }

  async saveConfig(configJson: string): Promise<{ message: string }> {
    const validation = this.validateConfig(configJson);
    if (!validation.valid) {
      return { message: `Config has errors: ${validation.errors.map((e) => e.message).join('; ')}` };
    }

    try {
      const { writeFile } = await import('fs/promises');
      await writeFile(XRAY_CONFIG_PATH, configJson);
    } catch {
      this.logger.warn('Could not write xray config');
      return { message: 'Failed to write config file' };
    }

    return this.restart();
  }

  async getDefaultConfig(): Promise<{ config: string }> {
    const config = await this.generateConfig();
    return { config: JSON.stringify(config, null, 2) };
  }

  validateConfig(configJson: string): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    // Step 1: Check JSON syntax
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJson) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof SyntaxError ? err.message : 'Invalid JSON';
      // Try to extract position from error message
      const posMatch = message.match(/position\s+(\d+)/i);
      let line = 1;
      let column = 1;
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const upToPos = configJson.substring(0, pos);
        line = (upToPos.match(/\n/g) || []).length + 1;
        const lastNewline = upToPos.lastIndexOf('\n');
        column = pos - lastNewline;
      }
      errors.push({ line, column, message, severity: 'error' });
      return { valid: false, errors, warnings };
    }

    // Step 2: Structural validation
    if (!parsed['log'] && !parsed['inbounds'] && !parsed['outbounds']) {
      warnings.push({
        line: 1,
        column: 1,
        message: 'Config appears empty - no log, inbounds, or outbounds found',
        severity: 'warning',
      });
    }

    if (parsed['inbounds'] && !Array.isArray(parsed['inbounds'])) {
      errors.push({
        line: 1,
        column: 1,
        message: '"inbounds" must be an array',
        severity: 'error',
      });
    }

    if (parsed['outbounds'] && !Array.isArray(parsed['outbounds'])) {
      errors.push({
        line: 1,
        column: 1,
        message: '"outbounds" must be an array',
        severity: 'error',
      });
    }

    // Step 3: Validate inbounds
    if (Array.isArray(parsed['inbounds'])) {
      const inbounds = parsed['inbounds'] as Array<Record<string, unknown>>;
      const ports = new Set<number>();
      const tags = new Set<string>();

      for (let i = 0; i < inbounds.length; i++) {
        const inbound = inbounds[i];
        if (!inbound['protocol']) {
          errors.push({
            line: 1,
            column: 1,
            message: `inbounds[${i}]: missing "protocol" field`,
            severity: 'error',
          });
        }
        if (!inbound['port']) {
          errors.push({
            line: 1,
            column: 1,
            message: `inbounds[${i}]: missing "port" field`,
            severity: 'error',
          });
        }
        if (typeof inbound['port'] === 'number') {
          if (ports.has(inbound['port'] as number)) {
            warnings.push({
              line: 1,
              column: 1,
              message: `inbounds[${i}]: duplicate port ${inbound['port']}`,
              severity: 'warning',
            });
          }
          ports.add(inbound['port'] as number);
        }
        if (typeof inbound['tag'] === 'string') {
          if (tags.has(inbound['tag'] as string)) {
            errors.push({
              line: 1,
              column: 1,
              message: `inbounds[${i}]: duplicate tag "${inbound['tag']}"`,
              severity: 'error',
            });
          }
          tags.add(inbound['tag'] as string);
        }
      }
    }

    // Step 4: Validate outbounds
    if (Array.isArray(parsed['outbounds'])) {
      const outbounds = parsed['outbounds'] as Array<Record<string, unknown>>;
      for (let i = 0; i < outbounds.length; i++) {
        if (!outbounds[i]['protocol']) {
          errors.push({
            line: 1,
            column: 1,
            message: `outbounds[${i}]: missing "protocol" field`,
            severity: 'error',
          });
        }
      }
      const hasDirect = outbounds.some((o) => o['protocol'] === 'freedom');
      if (!hasDirect) {
        warnings.push({
          line: 1,
          column: 1,
          message: 'No "freedom" outbound found - traffic may not route correctly',
          severity: 'warning',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
