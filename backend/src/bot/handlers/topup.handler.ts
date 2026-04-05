import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { BotStateService } from '../services/bot-state.service';
import { BotUserService } from '../services/bot-user.service';
import { PaymentService } from '../payments/payment.service';
import { YooKassaProvider } from '../payments/providers/yookassa.provider';
import { CryptoBotProvider } from '../payments/providers/cryptobot.provider';

@Injectable()
export class TopupHandler {
  private readonly logger = new Logger(TopupHandler.name);

  constructor(
    private readonly botUsers: BotUserService,
    private readonly state: BotStateService,
    private readonly payments: PaymentService,
    private readonly yookassa: YooKassaProvider,
    private readonly cryptobot: CryptoBotProvider,
  ) {}

  async showMenu(ctx: Context): Promise<void> {
    const kb = new InlineKeyboard();
    if (this.yookassa.isEnabled()) {
      kb.text('Top up via YooKassa', 'topup_yookassa').row();
    }
    if (this.cryptobot.isEnabled()) {
      kb.text('Top up via CryptoBot (USDT)', 'topup_cryptobot').row();
    }
    kb.text('Back', 'back_main');
    await this.safeEdit(ctx, 'Top up your balance — choose method:', kb);
  }

  async promptAmount(
    ctx: Context,
    provider: 'yookassa' | 'cryptobot',
  ): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    this.state.set(from.id, { kind: 'await_topup_amount', provider });
    await ctx.reply('Enter top-up amount (e.g. 500):');
  }

  async handleAmountInput(ctx: Context, raw: string): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const s = this.state.get(from.id);
    if (s.kind !== 'await_topup_amount') return;
    this.state.clear(from.id);

    const amount = parseFloat(raw.trim().replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      await ctx.reply('Invalid amount. Please try again.');
      return;
    }

    const botUser = await this.botUsers.findByTelegramId(from.id);
    if (!botUser) {
      await ctx.reply('Please /start first');
      return;
    }

    try {
      const { payment } = await this.payments.createTopup({
        botUserId: botUser.id,
        amount,
        currency: s.provider === 'cryptobot' ? 'USDT' : 'RUB',
        provider: s.provider as 'yookassa' | 'cryptobot',
      });
      if (payment.paymentUrl) {
        const kb = new InlineKeyboard().url('Pay now', payment.paymentUrl);
        await ctx.reply(`Top-up ${amount}. Click below to pay.`, {
          reply_markup: kb,
        });
      }
    } catch (err) {
      this.logger.error('Topup failed', err);
      const msg = err instanceof Error ? err.message : 'Top-up error';
      await ctx.reply(`Error: ${msg}`);
    }
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
