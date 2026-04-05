import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { XrayService } from '../xray/xray.service';
import { NodesService } from '../nodes/nodes.service';

interface UserLike {
  email?: string | null;
  id?: string;
  expiryDate?: Date | string | null;
}

interface NodeLike {
  name?: string | null;
  address?: string | null;
  id?: string;
}

interface BackupLike {
  id?: string;
  fileSize?: bigint | number | string | null;
  errorMsg?: string | null;
}

interface LoginFailedPayload {
  ip: string;
  attempts: number;
  email?: string;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: { stop: () => void } | null = null;
  private readonly botToken: string | undefined;
  private readonly adminId: string | undefined;
  private isRunning = false;
  private alertsEnabled = true;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly xrayService: XrayService,
    private readonly nodesService: NodesService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.adminId = this.configService.get<string>('TELEGRAM_ADMIN_ID');
  }

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, Telegram bot is disabled');
      return;
    }

    try {
      const grammy = await import('grammy');
      const bot = new grammy.Bot(this.botToken);

      this.registerCommands(bot);

      bot.start().catch((err: unknown) => {
        this.logger.error('Telegram bot polling error', err);
      });
      this.bot = bot;
      this.isRunning = true;
      this.logger.log('Telegram bot started successfully');
    } catch (err) {
      this.logger.error('Failed to start Telegram bot', err);
    }
  }

  async onModuleDestroy() {
    if (this.bot && this.isRunning) {
      this.bot.stop();
      this.isRunning = false;
      this.logger.log('Telegram bot stopped');
    }
  }

  private isAdminUser(fromId: number | undefined): boolean {
    if (!this.adminId || fromId === undefined) return false;
    return String(fromId) === this.adminId;
  }

  private registerCommands(bot: InstanceType<typeof import('grammy').Bot>) {
    bot.command('start', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) {
        await ctx.reply('Unauthorized. This bot is for HydraFlow admins only.');
        return;
      }
      await ctx.reply(
        'HydraFlow Panel Bot\n\n' +
        'Commands:\n' +
        '/users - User statistics\n' +
        '/stats - System stats\n' +
        '/node - Node status\n' +
        '/restart - Restart xray\n' +
        '/alerts on|off - Toggle notifications\n' +
        '/users_expired - List expired users\n' +
        '/stats_day - 24h summary',
      );
    });

    bot.command('users', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) return;
      try {
        const total = await this.prisma.user.count();
        const active = await this.prisma.user.count({ where: { enabled: true } });
        const expired = await this.prisma.user.count({
          where: {
            expiryDate: { lt: new Date() },
          },
        });
        const expiringSoon = await this.prisma.user.count({
          where: {
            enabled: true,
            expiryDate: {
              lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              gte: new Date(),
            },
          },
        });

        await ctx.reply(
          `Users:\n` +
          `Total: ${total}\n` +
          `Active: ${active}\n` +
          `Expired: ${expired}\n` +
          `Expiring in 3 days: ${expiringSoon}`,
        );
      } catch (err) {
        this.logger.error('Error in /users command', err);
        await ctx.reply('Error fetching user stats');
      }
    });

    bot.command('stats', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) return;
      try {
        const xrayStatus = await this.xrayService.getStatus();
        const users = await this.prisma.user.findMany({
          select: { trafficUp: true, trafficDown: true },
        });

        let totalUp = BigInt(0);
        let totalDown = BigInt(0);
        for (const u of users) {
          totalUp += u.trafficUp;
          totalDown += u.trafficDown;
        }

        const alerts = await this.prisma.alert.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        await ctx.reply(
          `System Stats:\n` +
          `Xray: ${xrayStatus.running ? 'Running' : 'Stopped'}\n` +
          `Xray version: ${xrayStatus.version ?? 'N/A'}\n` +
          `Traffic Up: ${formatBytesSimple(totalUp)}\n` +
          `Traffic Down: ${formatBytesSimple(totalDown)}\n` +
          `Alerts (24h): ${alerts}`,
        );
      } catch (err) {
        this.logger.error('Error in /stats command', err);
        await ctx.reply('Error fetching system stats');
      }
    });

    bot.command('node', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) return;
      try {
        const nodes = await this.nodesService.findAll();
        if (nodes.length === 0) {
          await ctx.reply('No nodes configured');
          return;
        }

        const lines = nodes.map(
          (n) => `${n.name} (${n.address}:${n.port}): ${n.status}${n.enabled ? '' : ' [disabled]'}`,
        );
        await ctx.reply(`Nodes:\n${lines.join('\n')}`);
      } catch (err) {
        this.logger.error('Error in /node command', err);
        await ctx.reply('Error fetching node status');
      }
    });

    bot.command('restart', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) return;
      try {
        await ctx.reply('Restarting xray...');
        const result = await this.xrayService.restart();
        await ctx.reply(result.message);
      } catch (err) {
        this.logger.error('Error in /restart command', err);
        await ctx.reply('Error restarting xray');
      }
    });

    bot.command('alerts', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) return;
      const arg = (ctx.message?.text ?? '').split(/\s+/)[1]?.toLowerCase();
      if (arg === 'on') {
        this.alertsEnabled = true;
        await ctx.reply('Alerts enabled');
      } else if (arg === 'off') {
        this.alertsEnabled = false;
        await ctx.reply('Alerts disabled');
      } else {
        await ctx.reply(
          `Alerts are currently ${this.alertsEnabled ? 'ON' : 'OFF'}. Use /alerts on|off`,
        );
      }
    });

    bot.command('users_expired', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) return;
      try {
        const users = await this.prisma.user.findMany({
          where: { expiryDate: { lt: new Date() } },
          select: { email: true, expiryDate: true },
          orderBy: { expiryDate: 'desc' },
          take: 25,
        });
        if (users.length === 0) {
          await ctx.reply('No expired users');
          return;
        }
        const lines = users.map(
          (u) =>
            `${u.email} - expired ${u.expiryDate ? u.expiryDate.toISOString().slice(0, 10) : 'n/a'}`,
        );
        await ctx.reply(`Expired users (max 25):\n${lines.join('\n')}`);
      } catch (err) {
        this.logger.error('Error in /users_expired command', err);
        await ctx.reply('Error listing expired users');
      }
    });

    bot.command('stats_day', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) return;
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const newUsers = await this.prisma.user.count({
          where: { createdAt: { gte: since } },
        });
        const alerts = await this.prisma.alert.count({
          where: { createdAt: { gte: since } },
        });
        const totalUsers = await this.prisma.user.count();
        const activeUsers = await this.prisma.user.count({ where: { enabled: true } });
        await ctx.reply(
          `24h summary:\n` +
          `New users: ${newUsers}\n` +
          `Alerts: ${alerts}\n` +
          `Total users: ${totalUsers}\n` +
          `Active users: ${activeUsers}`,
        );
      } catch (err) {
        this.logger.error('Error in /stats_day command', err);
        await ctx.reply('Error computing daily stats');
      }
    });
  }

  async notify(message: string): Promise<void> {
    if (!this.botToken || !this.adminId) return;
    if (!this.alertsEnabled) return;

    try {
      const grammy = await import('grammy');
      const api = new grammy.Api(this.botToken);
      await api.sendMessage(Number(this.adminId), message);
    } catch (err) {
      this.logger.error('Failed to send Telegram notification', err);
    }
  }

  async notifyNewUser(user: UserLike | string): Promise<void> {
    const email = typeof user === 'string' ? user : user.email ?? 'unknown';
    await this.notify(`New user registered: ${email}`);
  }

  async notifyUserExpired(user: UserLike | string): Promise<void> {
    const email = typeof user === 'string' ? user : user.email ?? 'unknown';
    await this.notify(`User subscription expired: ${email}`);
  }

  async notifyUserRenewed(user: UserLike | string): Promise<void> {
    const email = typeof user === 'string' ? user : user.email ?? 'unknown';
    const exp =
      typeof user === 'object' && user?.expiryDate
        ? new Date(user.expiryDate).toISOString().slice(0, 10)
        : 'n/a';
    await this.notify(`User renewed: ${email} (until ${exp})`);
  }

  async notifyProtocolBlocked(protocol: string, isp: string): Promise<void> {
    await this.notify(`Protocol blocked: ${protocol} on ${isp}`);
  }

  async notifyNodeDown(node: NodeLike | string): Promise<void> {
    const label =
      typeof node === 'string'
        ? node
        : `${node.name ?? 'node'} (${node.address ?? ''})`;
    await this.notify(`Node DOWN: ${label}`);
  }

  async notifyNodeUp(node: NodeLike | string): Promise<void> {
    const label =
      typeof node === 'string'
        ? node
        : `${node.name ?? 'node'} (${node.address ?? ''})`;
    await this.notify(`Node recovered: ${label}`);
  }

  async notifyLoginFailed(payload: LoginFailedPayload): Promise<void> {
    if (payload.attempts <= 5) return;
    await this.notify(
      `Suspicious login activity: ${payload.attempts} failed attempts from ${payload.ip}` +
        (payload.email ? ` (${payload.email})` : ''),
    );
  }

  async notifyBackupCompleted(backup: BackupLike): Promise<void> {
    const sizeStr = backup.fileSize
      ? formatBytesSimple(BigInt(String(backup.fileSize)))
      : 'unknown size';
    await this.notify(`Backup completed: ${backup.id ?? ''} (${sizeStr})`);
  }

  async notifyBackupFailed(backup: BackupLike): Promise<void> {
    await this.notify(
      `Backup FAILED: ${backup.id ?? ''}${
        backup.errorMsg ? ` - ${backup.errorMsg}` : ''
      }`,
    );
  }

  async notifyXrayRestart(success: boolean): Promise<void> {
    await this.notify(
      success
        ? 'Xray restarted successfully'
        : 'Xray restart failed!',
    );
  }

  // Event listeners
  @OnEvent('user.created')
  onUserCreated(user: UserLike) {
    void this.notifyNewUser(user);
  }

  @OnEvent('user.expired')
  onUserExpired(user: UserLike) {
    void this.notifyUserExpired(user);
  }

  @OnEvent('user.renewed')
  onUserRenewed(user: UserLike) {
    void this.notifyUserRenewed(user);
  }

  @OnEvent('protocol.blocked')
  onProtocolBlocked(payload: { protocol: string; isp: string }) {
    void this.notifyProtocolBlocked(payload.protocol, payload.isp);
  }

  @OnEvent('node.down')
  onNodeDown(node: NodeLike) {
    void this.notifyNodeDown(node);
  }

  @OnEvent('node.up')
  onNodeUp(node: NodeLike) {
    void this.notifyNodeUp(node);
  }

  @OnEvent('auth.failed')
  onAuthFailed(payload: LoginFailedPayload) {
    void this.notifyLoginFailed(payload);
  }

  @OnEvent('backup.completed')
  onBackupCompleted(backup: BackupLike) {
    void this.notifyBackupCompleted(backup);
  }

  @OnEvent('backup.failed')
  onBackupFailed(backup: BackupLike) {
    void this.notifyBackupFailed(backup);
  }
}

function formatBytesSimple(bytes: bigint): string {
  const num = Number(bytes);
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  const val = num / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}
