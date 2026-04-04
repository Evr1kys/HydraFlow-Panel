import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';

const execAsync = promisify(exec);

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

@Injectable()
export class XrayService {
  private readonly logger = new Logger(XrayService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return config;
  }
}
