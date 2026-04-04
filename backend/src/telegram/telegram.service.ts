import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { XrayService } from '../xray/xray.service';
import { NodesService } from '../nodes/nodes.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: { stop: () => void } | null = null;
  private readonly botToken: string | undefined;
  private readonly adminId: string | undefined;
  private isRunning = false;

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
        '/restart - Restart xray',
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
  }

  async notify(message: string): Promise<void> {
    if (!this.botToken || !this.adminId) return;

    try {
      const grammy = await import('grammy');
      const api = new grammy.Api(this.botToken);
      await api.sendMessage(Number(this.adminId), message);
    } catch (err) {
      this.logger.error('Failed to send Telegram notification', err);
    }
  }

  async notifyNewUser(email: string): Promise<void> {
    await this.notify(`New user registered: ${email}`);
  }

  async notifyUserExpired(email: string): Promise<void> {
    await this.notify(`User subscription expired: ${email}`);
  }

  async notifyProtocolBlocked(protocol: string, isp: string): Promise<void> {
    await this.notify(`Protocol blocked: ${protocol} on ${isp}`);
  }

  async notifyXrayRestart(success: boolean): Promise<void> {
    await this.notify(
      success
        ? 'Xray restarted successfully'
        : 'Xray restart failed!',
    );
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
