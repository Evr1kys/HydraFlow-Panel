import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrayService } from '../xray/xray.service';
import { NodesService } from '../nodes/nodes.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { encrypt, decrypt, isEncrypted } from '../common/crypto.util';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xrayService: XrayService,
    private readonly nodesService: NodesService,
  ) {}

  private maskSensitive<T extends Record<string, unknown>>(
    settings: T,
    reveal: boolean,
  ): T {
    if (reveal) return settings;
    const masked = { ...settings };
    const sensitiveKeys = ['realityPvk', 'ssPassword'] as const;
    for (const key of sensitiveKeys) {
      if (masked[key]) {
        (masked as Record<string, unknown>)[key] = '********';
      }
    }
    return masked;
  }

  async get(reveal = false) {
    let settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });
    if (!settings) {
      settings = await this.prisma.settings.create({
        data: { id: 'main' },
      });
    }
    return this.maskSensitive(
      settings as unknown as Record<string, unknown>,
      reveal,
    ) as typeof settings;
  }

  async update(dto: UpdateSettingsDto) {
    // Don't overwrite sensitive values if the client sent the mask placeholder
    const sanitized: Record<string, unknown> = { ...dto };
    for (const key of ['realityPvk', 'ssPassword'] as const) {
      if (sanitized[key] === '********') delete sanitized[key];
    }
    const settings = await this.prisma.settings.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...sanitized },
      update: sanitized,
    });

    const config = await this.xrayService.generateConfig();
    await this.xrayService.restart();

    // Push new xray config to all enabled nodes (best-effort, errors logged).
    try {
      const results = await this.nodesService.pushConfigToAll(
        JSON.stringify(config, null, 2),
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        this.logger.warn(
          `Xray config push: ${results.length - failed.length}/${results.length} succeeded. Failures: ${failed
            .map((f) => `${f.nodeId}:${f.error ?? 'unknown'}`)
            .join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to push xray config to nodes: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return settings;
  }

  private get encryptionSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required for encryption');
    return secret;
  }

  private decryptSmtpPass(smtpPass: string | null): string | null {
    if (!smtpPass) return null;
    // If value looks encrypted, decrypt it; otherwise it's legacy plaintext
    if (isEncrypted(smtpPass)) {
      try {
        return decrypt(smtpPass, this.encryptionSecret);
      } catch (err) {
        this.logger.warn('Failed to decrypt smtpPass, treating as plaintext');
        return smtpPass;
      }
    }
    return smtpPass;
  }

  async getEmail() {
    let settings = await this.prisma.emailSettings.findUnique({
      where: { id: 'main' },
    });
    if (!settings) {
      settings = await this.prisma.emailSettings.create({
        data: { id: 'main' },
      });
    }
    // never leak the password in GET
    return { ...settings, smtpPass: settings.smtpPass ? '********' : null };
  }

  /**
   * Return the raw (decrypted) email config for internal use (e.g. SMTP transport).
   */
  async getEmailDecrypted() {
    let settings = await this.prisma.emailSettings.findUnique({
      where: { id: 'main' },
    });
    if (!settings) {
      settings = await this.prisma.emailSettings.create({
        data: { id: 'main' },
      });
    }
    return {
      ...settings,
      smtpPass: this.decryptSmtpPass(settings.smtpPass),
    };
  }

  async updateEmail(dto: {
    enabled?: boolean;
    smtpHost?: string | null;
    smtpPort?: number;
    smtpUser?: string | null;
    smtpPass?: string | null;
    smtpSecure?: boolean;
    fromEmail?: string | null;
    fromName?: string;
  }) {
    // If caller sent the masked placeholder, keep existing password
    const data: Record<string, unknown> = { ...dto };
    if (dto.smtpPass === '********') {
      delete data.smtpPass;
    } else if (typeof dto.smtpPass === 'string' && dto.smtpPass.length > 0) {
      // Encrypt plaintext password before storing
      data.smtpPass = encrypt(dto.smtpPass, this.encryptionSecret);
    }

    const settings = await this.prisma.emailSettings.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...data },
      update: data,
    });
    return { ...settings, smtpPass: settings.smtpPass ? '********' : null };
  }
}
