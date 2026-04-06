import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createTransport, type Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt, isEncrypted } from '../common/crypto.util';

interface EmailPayloadUser {
  email?: string | null;
  subToken?: string | null;
  expiryDate?: Date | string | null;
}

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailConfig {
  enabled: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  fromEmail: string | null;
  fromName: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private decryptSmtpPass(smtpPass: string | null): string | null {
    if (!smtpPass) return null;
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      this.logger.warn('JWT_SECRET not set, cannot decrypt smtpPass');
      return smtpPass;
    }
    if (isEncrypted(smtpPass)) {
      try {
        return decrypt(smtpPass, secret);
      } catch {
        this.logger.warn('Failed to decrypt smtpPass, using as-is');
        return smtpPass;
      }
    }
    return smtpPass;
  }

  private async getConfig(): Promise<EmailConfig | null> {
    const settings = await this.prisma.emailSettings.findUnique({
      where: { id: 'main' },
    });
    if (!settings) return null;
    return {
      enabled: settings.enabled,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpPass: this.decryptSmtpPass(settings.smtpPass),
      smtpSecure: settings.smtpSecure,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
    };
  }

  private buildTransport(cfg: EmailConfig): Transporter | null {
    if (!cfg.smtpHost || !cfg.fromEmail) return null;
    return createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth:
        cfg.smtpUser && cfg.smtpPass
          ? { user: cfg.smtpUser, pass: cfg.smtpPass }
          : undefined,
    });
  }

  private async send(opts: SendOptions): Promise<boolean> {
    const cfg = await this.getConfig();
    if (!cfg || !cfg.enabled) {
      this.logger.log('Email disabled, skipping send');
      return false;
    }
    const transport = this.buildTransport(cfg);
    if (!transport) {
      this.logger.warn('SMTP config incomplete, cannot send email');
      return false;
    }
    try {
      await transport.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text ?? stripHtml(opts.html),
      });
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${opts.to}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  async sendSubscriptionExpiry(
    userEmail: string,
    expiresIn: string,
  ): Promise<boolean> {
    const html = renderTemplate('expiry', {
      title: 'Subscription expiring soon',
      body: `Your HydraFlow subscription will expire in <strong>${expiresIn}</strong>. Please renew to keep uninterrupted access.`,
    });
    return this.send({
      to: userEmail,
      subject: 'Your HydraFlow subscription is expiring',
      html,
    });
  }

  async sendPasswordReset(
    adminEmail: string,
    resetToken: string,
  ): Promise<boolean> {
    const html = renderTemplate('reset', {
      title: 'Password reset request',
      body: `A password reset was requested. Use the code below to reset your password:<br/><br/><code style="font-size:20px;padding:8px 12px;background:#f3f4f6;border-radius:6px;">${resetToken}</code><br/><br/>If you didn't request this, ignore this email.`,
    });
    return this.send({
      to: adminEmail,
      subject: 'HydraFlow password reset',
      html,
    });
  }

  async sendWelcome(userEmail: string, subUrl: string): Promise<boolean> {
    const html = renderTemplate('welcome', {
      title: 'Welcome to HydraFlow',
      body: `Your account is ready. Use the subscription URL below in your VPN client:<br/><br/><a href="${subUrl}" style="color:#20c997;word-break:break-all;">${subUrl}</a>`,
    });
    return this.send({
      to: userEmail,
      subject: 'Welcome to HydraFlow',
      html,
    });
  }

  async sendTwoFactorCode(adminEmail: string, code: string): Promise<boolean> {
    const html = renderTemplate('2fa', {
      title: 'Your login code',
      body: `Use this one-time code to finish signing in:<br/><br/><code style="font-size:28px;padding:12px 16px;background:#f3f4f6;border-radius:6px;letter-spacing:4px;">${code}</code><br/><br/>The code expires in 5 minutes.`,
    });
    return this.send({
      to: adminEmail,
      subject: 'HydraFlow login code',
      html,
    });
  }

  async sendTest(toEmail: string): Promise<boolean> {
    const html = renderTemplate('test', {
      title: 'SMTP test',
      body: 'If you can read this, your SMTP settings are configured correctly.',
    });
    return this.send({
      to: toEmail,
      subject: 'HydraFlow SMTP test',
      html,
    });
  }

  // Event listeners
  @OnEvent('user.created')
  async onUserCreated(user: EmailPayloadUser) {
    if (!user?.email || !user.subToken) return;
    const subUrl = `/api/subscription/${user.subToken}`;
    await this.sendWelcome(user.email, subUrl);
  }

  @OnEvent('user.expiring_soon')
  async onUserExpiringSoon(user: EmailPayloadUser) {
    if (!user?.email) return;
    const expiresIn = user.expiryDate
      ? daysUntil(new Date(user.expiryDate))
      : 'a few days';
    await this.sendSubscriptionExpiry(user.email, expiresIn);
  }

  @OnEvent('user.expired')
  async onUserExpired(user: EmailPayloadUser) {
    if (!user?.email) return;
    await this.sendSubscriptionExpiry(user.email, 'today');
  }

  @OnEvent('auth.password_reset')
  async onPasswordReset(payload: { email: string; token: string }) {
    if (!payload?.email) return;
    await this.sendPasswordReset(payload.email, payload.token);
  }

  @OnEvent('auth.2fa_code')
  async on2faCode(payload: { email: string; code: string }) {
    if (!payload?.email) return;
    await this.sendTwoFactorCode(payload.email, payload.code);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function daysUntil(date: Date): string {
  const diff = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return '1 day';
  return `${diff} days`;
}

function renderTemplate(
  _name: string,
  vars: { title: string; body: string },
): string {
  return `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f6f8fa;padding:24px;color:#24292f;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#20c997,#339af0);"></div>
        <strong style="font-size:18px;">HydraFlow</strong>
      </div>
      <h1 style="font-size:20px;margin:0 0 12px;">${vars.title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#4b5563;">${vars.body}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <div style="font-size:12px;color:#9ca3af;">HydraFlow Panel</div>
    </div>
  </body>
</html>`;
}
