import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { execSync } from 'child_process';

export interface XrayStatus {
  running: boolean;
  version: string | null;
  uptime: number | null;
}

@Injectable()
export class XrayService {
  private readonly logger = new Logger(XrayService.name);

  constructor(private readonly redis: RedisService, private readonly prisma: PrismaService) {}

  async getStatus(): Promise<XrayStatus> {
    try {
      const version = execSync('xray version 2>/dev/null || echo ""').toString().trim();
      const isRunning = this.isXrayRunning();
      const startedAt = await this.redis.get('xray:started_at');
      const uptime = startedAt ? Math.floor((Date.now() - parseInt(startedAt, 10)) / 1000) : null;
      return { running: isRunning, version: version || null, uptime };
    } catch {
      return { running: false, version: null, uptime: null };
    }
  }

  async restart(): Promise<{ success: boolean; message: string }> {
    try {
      execSync('pkill -f xray || true');
      const config = await this.buildConfig();
      execSync(`echo '${JSON.stringify(config)}' | xray run -config stdin: &`);
      await this.redis.set('xray:started_at', Date.now().toString());
      return { success: true, message: 'Xray restarted successfully' };
    } catch (error) {
      this.logger.error('Failed to restart xray', error);
      return { success: false, message: 'Failed to restart xray' };
    }
  }

  async getConfig() { return this.buildConfig(); }

  async updateConfig(config: Record<string, any>) {
    await this.redis.set('xray:config_override', JSON.stringify(config));
    return this.restart();
  }

  private isXrayRunning(): boolean {
    try { execSync('pgrep -f xray'); return true; } catch { return false; }
  }

  private async buildConfig() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'main' } });
    const override = await this.redis.get('xray:config_override');
    if (override) { try { return JSON.parse(override); } catch { /* fall through */ } }
    return {
      log: { loglevel: 'warning' },
      inbounds: [{
        tag: 'vless-reality', port: settings?.realityPort || 443, protocol: 'vless',
        settings: { clients: [], decryption: 'none' },
        streamSettings: {
          network: 'tcp', security: 'reality',
          realitySettings: {
            show: false, dest: `${settings?.realitySni || 'www.apple.com'}:443`, xver: 0,
            serverNames: [settings?.realitySni || 'www.apple.com'],
            privateKey: settings?.realityPrivateKey || '', shortIds: [settings?.realityShortId || ''],
          },
        },
      }],
      outbounds: [{ tag: 'direct', protocol: 'freedom' }, { tag: 'blocked', protocol: 'blackhole' }],
    };
  }
}
