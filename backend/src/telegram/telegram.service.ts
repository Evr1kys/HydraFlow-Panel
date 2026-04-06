import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { XrayService } from '../xray/xray.service';
import { NodesService } from '../nodes/nodes.service';
import type { Bot, Context } from 'grammy';

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

type InlineButton = { text: string; url: string };
type InlineKeyboard = InlineButton[][];

type GrammyBot = Bot<Context>;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: GrammyBot | null = null;
  private readonly botToken: string | undefined;
  private readonly adminId: string | undefined;
  private readonly adminIds: number[];
  private readonly publicBaseUrl: string;
  private isRunning = false;
  private alertsEnabled = true;
  private adminHandlersRegistered = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly xrayService: XrayService,
    private readonly nodesService: NodesService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.adminId = this.configService.get<string>('TELEGRAM_ADMIN_ID');
    this.publicBaseUrl =
      this.configService.get<string>('PUBLIC_BASE_URL') ??
      'https://panel.hydraflow.xyz';
    this.adminIds = (this.adminId ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
  }

  private panelUrl(path: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  private userButton(userId?: string): InlineButton {
    return userId
      ? { text: 'View User', url: this.panelUrl(`/users?id=${encodeURIComponent(userId)}`) }
      : { text: 'View All Users', url: this.panelUrl('/users') };
  }

  private nodeButton(nodeId?: string): InlineButton {
    return nodeId
      ? { text: 'View Node', url: this.panelUrl(`/nodes?id=${encodeURIComponent(nodeId)}`) }
      : { text: 'View Nodes', url: this.panelUrl('/nodes') };
  }

  private allUsersButton(): InlineButton {
    return { text: 'View All Users', url: this.panelUrl('/users') };
  }

  /**
   * Returns the shared Bot instance. BotService uses this to register
   * shop handlers on the same instance, avoiding 409 Conflict.
   */
  getBotInstance(): GrammyBot | null {
    return this.bot;
  }

  /** Whether admin command handlers have been registered (bot is ready for shop handlers). */
  isReady(): boolean {
    return this.adminHandlersRegistered;
  }

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, Telegram bot is disabled');
      return;
    }

    try {
      const grammy = await import('grammy');
      const bot: GrammyBot = new grammy.Bot(this.botToken);

      this.registerCommands(bot);
      this.adminHandlersRegistered = true;
      this.bot = bot;

      // Note: bot.start() is called in startPolling(), which should be invoked
      // AFTER BotService has registered its handlers.
      this.logger.log('Telegram bot instance created, admin handlers registered');
    } catch (err) {
      this.logger.error('Failed to create Telegram bot', err);
    }
  }

  /**
   * Start long-polling. Called after all handlers (admin + shop) are registered.
   */
  startPolling(): void {
    if (!this.bot || this.isRunning) return;
    this.bot.catch((err: unknown) => {
      this.logger.error('Telegram bot error', err);
    });
    this.bot.start({ drop_pending_updates: true }).catch((err: unknown) => {
      this.logger.error('Telegram bot polling error', err);
    });
    this.isRunning = true;
    this.logger.log('Telegram bot polling started');
  }

  async onModuleDestroy() {
    if (this.bot && this.isRunning) {
      this.bot.stop();
      this.isRunning = false;
      this.logger.log('Telegram bot stopped');
    }
  }

  private isAdminUser(fromId: number | undefined): boolean {
    if (fromId === undefined) return false;
    if (this.adminIds.length > 0) {
      return this.adminIds.includes(fromId);
    }
    if (!this.adminId) return false;
    return String(fromId) === this.adminId;
  }

  private registerCommands(bot: GrammyBot) {
    bot.command('start', async (ctx) => {
      if (!this.isAdminUser(ctx.message?.from?.id)) {
        // Non-admin /start is handled by BotService shop handlers (if registered).
        // If not handled there, just ignore.
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

  async notify(message: string, keyboard?: InlineKeyboard): Promise<void> {
    if (!this.botToken) return;
    if (!this.alertsEnabled) return;

    const recipients =
      this.adminIds.length > 0
        ? this.adminIds
        : this.adminId
          ? [Number(this.adminId)]
          : [];
    if (recipients.length === 0) return;

    try {
      const grammy = await import('grammy');
      const api = new grammy.Api(this.botToken);
      const options: {
        parse_mode: 'HTML';
        reply_markup?: { inline_keyboard: InlineKeyboard };
      } = { parse_mode: 'HTML' };
      if (keyboard && keyboard.length > 0) {
        options.reply_markup = { inline_keyboard: keyboard };
      }
      for (const chatId of recipients) {
        try {
          await api.sendMessage(chatId, message, options);
        } catch (err) {
          this.logger.error(
            `Failed to send Telegram notification to ${chatId}`,
            err,
          );
        }
      }
    } catch (err) {
      this.logger.error('Failed to send Telegram notification', err);
    }
  }

  async notifyNewUser(user: UserLike | string): Promise<void> {
    const email = typeof user === 'string' ? user : user.email ?? 'unknown';
    const userId = typeof user === 'object' ? user.id : undefined;
    await this.notify(`New user registered: <b>${escapeHtml(email)}</b>`, [
      [this.userButton(userId), this.allUsersButton()],
    ]);
  }

  async notifyUserExpired(user: UserLike | string): Promise<void> {
    const email = typeof user === 'string' ? user : user.email ?? 'unknown';
    const userId = typeof user === 'object' ? user.id : undefined;
    await this.notify(
      `User subscription expired: <b>${escapeHtml(email)}</b>`,
      [[this.userButton(userId), this.allUsersButton()]],
    );
  }

  async notifyUserRenewed(user: UserLike | string): Promise<void> {
    const email = typeof user === 'string' ? user : user.email ?? 'unknown';
    const userId = typeof user === 'object' ? user.id : undefined;
    const exp =
      typeof user === 'object' && user?.expiryDate
        ? new Date(user.expiryDate).toISOString().slice(0, 10)
        : 'n/a';
    await this.notify(
      `User renewed: <b>${escapeHtml(email)}</b> (until ${exp})`,
      [[this.userButton(userId), this.allUsersButton()]],
    );
  }

  async notifyProtocolBlocked(protocol: string, isp: string): Promise<void> {
    await this.notify(
      `Protocol blocked: <b>${escapeHtml(protocol)}</b> on ${escapeHtml(isp)}`,
    );
  }

  async notifyNodeDown(node: NodeLike | string): Promise<void> {
    const label =
      typeof node === 'string'
        ? node
        : `${node.name ?? 'node'} (${node.address ?? ''})`;
    const nodeId = typeof node === 'object' ? node.id : undefined;
    await this.notify(`Node DOWN: <b>${escapeHtml(label)}</b>`, [
      [this.nodeButton(nodeId)],
    ]);
  }

  async notifyNodeUp(node: NodeLike | string): Promise<void> {
    const label =
      typeof node === 'string'
        ? node
        : `${node.name ?? 'node'} (${node.address ?? ''})`;
    const nodeId = typeof node === 'object' ? node.id : undefined;
    await this.notify(`Node recovered: <b>${escapeHtml(label)}</b>`, [
      [this.nodeButton(nodeId)],
    ]);
  }

  async notifyLoginFailed(payload: LoginFailedPayload): Promise<void> {
    if (payload.attempts <= 5) return;
    await this.notify(
      `Suspicious login activity: ${payload.attempts} failed attempts from <b>${escapeHtml(payload.ip)}</b>` +
        (payload.email ? ` (${escapeHtml(payload.email)})` : ''),
    );
  }

  async notifyBackupCompleted(backup: BackupLike): Promise<void> {
    const sizeStr = backup.fileSize
      ? formatBytesSimple(BigInt(String(backup.fileSize)))
      : 'unknown size';
    await this.notify(
      `Backup completed: ${escapeHtml(backup.id ?? '')} (${sizeStr})`,
    );
  }

  async notifyBackupFailed(backup: BackupLike): Promise<void> {
    await this.notify(
      `Backup FAILED: ${escapeHtml(backup.id ?? '')}${
        backup.errorMsg ? ` - ${escapeHtml(backup.errorMsg)}` : ''
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
