import { Injectable } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import { BotUserService } from '../services/bot-user.service';
import { KeyboardBuilder } from '../keyboards/keyboard.builder';

@Injectable()
export class StartHandler {
  constructor(
    private readonly botUsers: BotUserService,
    private readonly keyboards: KeyboardBuilder,
  ) {}

  async handle(ctx: Context): Promise<void> {
    const from = ctx.from;
    if (!from) return;

    // Parse referral code from /start <code>
    const text = ctx.message?.text ?? '';
    const parts = text.split(/\s+/);
    const startParam = parts.length > 1 ? parts[1] : undefined;

    const existing = await this.botUsers.findByTelegramId(from.id);
    const referredBy =
      !existing && startParam && startParam.startsWith('ref_')
        ? startParam.slice(4)
        : undefined;

    const botUser = await this.botUsers.getOrCreate({
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
      languageCode: from.language_code,
      referredBy,
    });

    if (botUser.banned) {
      await ctx.reply('You are banned from using this bot.');
      return;
    }

    const welcome =
      `Welcome, ${from.first_name ?? 'friend'}!\n\n` +
      `This is the HydraFlow VPN shop.\n` +
      `Use the menu below to buy a subscription, check your account, or get support.`;

    const kb =
      (await this.keyboards.build('main_menu')) ?? this.defaultMainMenu();

    await ctx.reply(welcome, { reply_markup: kb });
  }

  private defaultMainMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('Buy VPN', 'buy_menu')
      .text('My subscriptions', 'profile_menu')
      .row()
      .text('Top up', 'topup_menu')
      .text('Referral', 'referral_menu')
      .row()
      .text('How to connect', 'howto_menu')
      .text('Support', 'support_menu');
  }
}
