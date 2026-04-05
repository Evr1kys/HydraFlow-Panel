import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'grammy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BotStateService } from '../services/bot-state.service';
import { BotUserService } from '../services/bot-user.service';
import { SubscriptionGrantService } from '../services/subscription-grant.service';
import { PromoService } from '../services/promo.service';

@Injectable()
export class AdminHandler {
  private readonly logger = new Logger(AdminHandler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly state: BotStateService,
    private readonly botUsers: BotUserService,
    private readonly grants: SubscriptionGrantService,
    private readonly promos: PromoService,
  ) {}

  isAdmin(telegramId: number | undefined): boolean {
    if (telegramId === undefined) return false;
    const adminIds = (this.config.get<string>('TELEGRAM_ADMIN_ID') ?? '').split(',');
    return adminIds.map((s) => s.trim()).includes(String(telegramId));
  }

  async handleBroadcastStart(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from || !this.isAdmin(from.id)) return;
    this.state.set(from.id, { kind: 'await_broadcast_text', adminId: from.id });
    await ctx.reply('Send the broadcast message (or /cancel):');
  }

  async handleBroadcastText(ctx: Context, text: string): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const s = this.state.get(from.id);
    if (s.kind !== 'await_broadcast_text') return;
    this.state.clear(from.id);

    if (text.trim() === '/cancel') {
      await ctx.reply('Broadcast cancelled.');
      return;
    }

    const ids = await this.botUsers.getAllTelegramIds();
    await ctx.reply(`Broadcasting to ${ids.length} users...`);

    let sent = 0;
    let failed = 0;
    for (const tgId of ids) {
      try {
        await ctx.api.sendMessage(Number(tgId), text);
        sent += 1;
        // simple throttle
        await new Promise((r) => setTimeout(r, 35));
      } catch (err) {
        failed += 1;
        this.logger.warn(`Broadcast to ${tgId} failed: ${String(err)}`);
      }
    }
    await ctx.reply(`Broadcast done. Sent: ${sent}, failed: ${failed}`);
  }

  async handleGiveSub(ctx: Context, args: string[]): Promise<void> {
    const from = ctx.from;
    if (!from || !this.isAdmin(from.id)) return;
    if (args.length < 2) {
      await ctx.reply('Usage: /give_sub <user_id> <days> [trafficGb]');
      return;
    }
    const telegramId = parseInt(args[0], 10);
    const days = parseInt(args[1], 10);
    const trafficGb = args[2] ? parseInt(args[2], 10) : undefined;
    if (!Number.isFinite(telegramId) || !Number.isFinite(days)) {
      await ctx.reply('Invalid arguments');
      return;
    }
    try {
      const result = await this.grants.manualGrant({
        telegramId,
        days,
        trafficGb: trafficGb ?? null,
      });
      await ctx.reply(
        `Granted ${days} days to ${telegramId}. Expires: ${result.expiryDate.toISOString().slice(0, 10)}`,
      );
      try {
        await ctx.api.sendMessage(
          telegramId,
          `An admin granted you ${days} days of VPN access. Enjoy!`,
        );
      } catch {
        /* ignore */
      }
    } catch (err) {
      await ctx.reply(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async handleBan(ctx: Context, args: string[]): Promise<void> {
    const from = ctx.from;
    if (!from || !this.isAdmin(from.id)) return;
    if (args.length < 1) {
      await ctx.reply('Usage: /ban <user_id>');
      return;
    }
    const telegramId = BigInt(args[0]);
    const user = await this.prisma.botUser.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('User not found');
      return;
    }
    await this.botUsers.setBanned(user.id, true);
    await ctx.reply(`User ${telegramId} banned.`);
  }

  async handlePromoCreate(ctx: Context, args: string[]): Promise<void> {
    const from = ctx.from;
    if (!from || !this.isAdmin(from.id)) return;
    // /promo create CODE 10 50 -> code, percent, maxUses
    if (args.length < 2 || args[0] !== 'create') {
      await this.handlePromoList(ctx, args);
      return;
    }
    const code = args[1];
    const percent = args[2] ? parseInt(args[2], 10) : undefined;
    const maxUses = args[3] ? parseInt(args[3], 10) : undefined;
    const promo = await this.promos.create({
      code,
      discountPercent: percent ?? null,
      maxUses: maxUses ?? null,
    });
    await ctx.reply(
      `Promo ${promo.code} created (${percent ?? 0}% off, ${maxUses ?? 'unlimited'} uses)`,
    );
  }

  async handlePromoList(ctx: Context, _args: string[]): Promise<void> {
    const from = ctx.from;
    if (!from || !this.isAdmin(from.id)) return;
    const items = await this.promos.list();
    if (items.length === 0) {
      await ctx.reply('No promo codes.');
      return;
    }
    const lines = items.map(
      (p) =>
        `${p.code} - ${p.discountPercent ?? 0}% - used ${p.usedCount}/${p.maxUses ?? '∞'} - ${p.enabled ? 'on' : 'off'}`,
    );
    await ctx.reply(lines.join('\n'));
  }

  async handlePromoDelete(ctx: Context, args: string[]): Promise<void> {
    const from = ctx.from;
    if (!from || !this.isAdmin(from.id)) return;
    if (args.length < 1) {
      await ctx.reply('Usage: /promo_delete <code>');
      return;
    }
    const promo = await this.promos.findByCode(args[0]);
    if (!promo) {
      await ctx.reply('Not found');
      return;
    }
    await this.promos.remove(promo.id);
    await ctx.reply(`Promo ${args[0]} deleted.`);
  }
}
