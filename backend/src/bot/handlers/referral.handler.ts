import { Injectable } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BotUserService } from '../services/bot-user.service';

@Injectable()
export class ReferralHandler {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly botUsers: BotUserService,
  ) {}

  async showMenu(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const botUser = await this.botUsers.findByTelegramId(from.id);
    if (!botUser) {
      await ctx.reply('Please /start first');
      return;
    }

    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? 'hydraflow_bot';
    const link = `https://t.me/${botUsername}?start=ref_${botUser.telegramId.toString()}`;

    const invited = await this.prisma.botUser.count({
      where: { referredBy: botUser.telegramId.toString() },
    });

    const text =
      `Referral program\n\n` +
      `Your link:\n${link}\n\n` +
      `Invite friends and get 10% of their first purchase to your balance.\n` +
      `People you invited: ${invited}\n` +
      `Your balance: ${botUser.balance}`;

    const kb = new InlineKeyboard()
      .url('Share link', `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Fast VPN - try HydraFlow')}`)
      .row()
      .text('Back', 'back_main');

    await this.safeEdit(ctx, text, kb);
  }

  private async safeEdit(
    ctx: Context,
    text: string,
    kb?: InlineKeyboard,
  ): Promise<void> {
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { reply_markup: kb, link_preview_options: { is_disabled: true } });
        return;
      } catch {
        /* fallthrough */
      }
    }
    await ctx.reply(text, { reply_markup: kb, link_preview_options: { is_disabled: true } });
  }
}
