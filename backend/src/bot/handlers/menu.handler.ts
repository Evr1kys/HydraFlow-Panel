import { Injectable } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { KeyboardBuilder } from '../keyboards/keyboard.builder';

@Injectable()
export class MenuHandler {
  constructor(private readonly keyboards: KeyboardBuilder) {}

  async showMainMenu(ctx: Context): Promise<void> {
    const kb =
      (await this.keyboards.build('main_menu')) ??
      new InlineKeyboard()
        .text('Buy VPN', 'buy_menu')
        .text('My subscriptions', 'profile_menu')
        .row()
        .text('Top up', 'topup_menu')
        .text('Referral', 'referral_menu')
        .row()
        .text('How to connect', 'howto_menu')
        .text('Support', 'support_menu');

    const text = 'Main menu — choose an option:';
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { reply_markup: kb });
      } catch {
        await ctx.reply(text, { reply_markup: kb });
      }
    } else {
      await ctx.reply(text, { reply_markup: kb });
    }
  }
}
