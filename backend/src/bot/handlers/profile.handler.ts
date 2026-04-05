import { Injectable } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { BotUserService } from '../services/bot-user.service';
import { ConfigService } from '@nestjs/config';

function formatBytes(n: bigint): string {
  const num = Number(n);
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${(num / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

@Injectable()
export class ProfileHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botUsers: BotUserService,
    private readonly config: ConfigService,
  ) {}

  async showProfile(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const botUser = await this.botUsers.findByTelegramId(from.id);
    if (!botUser) {
      await ctx.reply('Please /start first');
      return;
    }

    const lines: string[] = [];
    lines.push(`Balance: ${botUser.balance}`);
    lines.push(`Total spent: ${botUser.totalSpent}`);
    lines.push('');

    if (botUser.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: botUser.userId },
      });
      if (user) {
        const up = formatBytes(user.trafficUp);
        const down = formatBytes(user.trafficDown);
        const limit = user.trafficLimit
          ? formatBytes(user.trafficLimit)
          : 'unlimited';
        const expiry = user.expiryDate
          ? user.expiryDate.toISOString().slice(0, 10)
          : 'no expiry';
        lines.push(`Active subscription:`);
        lines.push(`Expires: ${expiry}`);
        lines.push(`Traffic used: up ${up} / down ${down}`);
        lines.push(`Traffic limit: ${limit}`);
        lines.push(`Status: ${user.enabled ? 'active' : 'disabled'}`);

        const baseUrl =
          this.config.get<string>('PUBLIC_BASE_URL') ??
          this.config.get<string>('BOT_WEBHOOK_URL')?.replace(/\/api\/bot\/webhook\/?$/, '') ??
          '';
        const subUrl = baseUrl ? `${baseUrl}/sub/${user.subToken}` : `sub token: ${user.subToken}`;
        const kb = new InlineKeyboard();
        if (baseUrl) {
          kb.url('Open subscription', subUrl).row();
        }
        kb.text('Back', 'back_main');
        await this.safeEdit(ctx, lines.join('\n') + `\n\nSubscription link:\n${subUrl}`, kb);
        return;
      }
    }

    lines.push('No active subscription yet.');
    const kb = new InlineKeyboard().text('Buy now', 'buy_menu').row().text('Back', 'back_main');
    await this.safeEdit(ctx, lines.join('\n'), kb);
  }

  private async safeEdit(
    ctx: Context,
    text: string,
    kb?: InlineKeyboard,
  ): Promise<void> {
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { reply_markup: kb });
        return;
      } catch {
        /* fallthrough */
      }
    }
    await ctx.reply(text, { reply_markup: kb });
  }
}
