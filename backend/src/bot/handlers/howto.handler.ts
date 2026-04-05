import { Injectable } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';

const INSTRUCTIONS: Record<string, string> = {
  ios:
    'iOS instructions:\n' +
    '1. Install Hiddify or Streisand from App Store\n' +
    '2. Open your subscription link from the Profile menu\n' +
    '3. Tap "Import to app" and select the client\n' +
    '4. Enable the VPN connection',
  android:
    'Android instructions:\n' +
    '1. Install v2rayNG or Hiddify from Google Play\n' +
    '2. Open your subscription link\n' +
    '3. Tap "Import" and select the client\n' +
    '4. Enable the VPN connection',
  windows:
    'Windows instructions:\n' +
    '1. Download Hiddify for Windows: https://hiddify.com\n' +
    '2. Install and open the app\n' +
    '3. Paste your subscription URL\n' +
    '4. Click Connect',
  macos:
    'macOS instructions:\n' +
    '1. Download Hiddify or V2Box from App Store\n' +
    '2. Paste your subscription URL\n' +
    '3. Enable the VPN connection',
};

@Injectable()
export class HowtoHandler {
  async showMenu(ctx: Context): Promise<void> {
    const kb = new InlineKeyboard()
      .text('iOS', 'howto_ios')
      .text('Android', 'howto_android')
      .row()
      .text('Windows', 'howto_windows')
      .text('macOS', 'howto_macos')
      .row()
      .text('Back', 'back_main');
    await this.safeEdit(ctx, 'Choose your platform:', kb);
  }

  async showPlatform(ctx: Context, platform: string): Promise<void> {
    const text = INSTRUCTIONS[platform] ?? 'Instructions not available';
    const kb = new InlineKeyboard()
      .text('Back to platforms', 'howto_menu')
      .row()
      .text('Main menu', 'back_main');
    await this.safeEdit(ctx, text, kb);
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
