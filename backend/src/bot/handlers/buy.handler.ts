import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { BotPlanService } from '../services/bot-plan.service';
import { BotUserService } from '../services/bot-user.service';
import { BotStateService } from '../services/bot-state.service';
import { PaymentService } from '../payments/payment.service';
import { YooKassaProvider } from '../payments/providers/yookassa.provider';
import { CryptoBotProvider } from '../payments/providers/cryptobot.provider';
import { TelegramStarsProvider } from '../payments/providers/telegram-stars.provider';

@Injectable()
export class BuyHandler {
  private readonly logger = new Logger(BuyHandler.name);

  constructor(
    private readonly botUsers: BotUserService,
    private readonly plans: BotPlanService,
    private readonly payments: PaymentService,
    private readonly state: BotStateService,
    private readonly yookassa: YooKassaProvider,
    private readonly cryptobot: CryptoBotProvider,
    private readonly stars: TelegramStarsProvider,
  ) {}

  async showPlans(ctx: Context): Promise<void> {
    const plans = await this.plans.list(true);
    if (plans.length === 0) {
      await this.safeEdit(ctx, 'No plans available right now. Please check back later.');
      return;
    }
    const kb = new InlineKeyboard();
    for (const p of plans) {
      const traffic = p.trafficGb === null ? 'unlimited' : `${p.trafficGb}GB`;
      kb.text(
        `${p.name} - ${p.daysDuration}d / ${traffic} - ${p.price} ${p.currency}`,
        `plan_${p.id}`,
      ).row();
    }
    kb.text('Back', 'back_main');
    await this.safeEdit(ctx, 'Choose a plan:', kb);
  }

  async showPaymentMethods(ctx: Context, planId: string): Promise<void> {
    const plan = await this.plans.findById(planId).catch(() => null);
    if (!plan) {
      await ctx.answerCallbackQuery('Plan not found');
      return;
    }
    const kb = new InlineKeyboard();
    if (this.yookassa.isEnabled()) {
      kb.text('Card / SBP (YooKassa)', `pay_yookassa_${planId}`).row();
    }
    kb.text('Telegram Stars', `pay_stars_${planId}`).row();
    if (this.cryptobot.isEnabled()) {
      kb.text('USDT (CryptoBot)', `pay_cryptobot_${planId}`).row();
    }
    kb.text('Pay from balance', `pay_balance_${planId}`).row();
    kb.text('Apply promo code', `promo_${planId}`).row();
    kb.text('Back', 'buy_menu');
    const traffic = plan.trafficGb === null ? 'unlimited' : `${plan.trafficGb}GB`;
    await this.safeEdit(
      ctx,
      `Plan: ${plan.name}\nDuration: ${plan.daysDuration} days\nTraffic: ${traffic}\nPrice: ${plan.price} ${plan.currency}\n\nChoose payment method:`,
      kb,
    );
  }

  async promptPromo(ctx: Context, planId: string, provider: string): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    this.state.set(from.id, { kind: 'await_promo', planId, provider });
    await ctx.reply('Send your promo code (or /cancel to skip):');
  }

  async startCheckout(
    ctx: Context,
    planId: string,
    provider: 'yookassa' | 'stars' | 'cryptobot' | 'balance',
    promoCode?: string,
  ): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const botUser = await this.botUsers.findByTelegramId(from.id);
    if (!botUser) {
      await ctx.reply('Please /start first');
      return;
    }

    try {
      const result = await this.payments.createCheckout({
        botUserId: botUser.id,
        planId,
        provider,
        promoCode,
      });

      if (result.usedBalance) {
        await ctx.reply(
          `Subscription activated.\nAmount deducted: ${result.finalAmount}`,
        );
        return;
      }

      const payment = result.payment;
      if (!payment) {
        await ctx.reply('Payment creation failed');
        return;
      }

      // Telegram Stars special case: send invoice
      if (provider === 'stars' && payment.telegramInvoice) {
        const inv = payment.telegramInvoice;
        await ctx.api.sendInvoice(
          from.id,
          inv.title,
          inv.description,
          inv.payload,
          inv.currency,
          inv.prices,
        );
        return;
      }

      if (payment.paymentUrl) {
        const kb = new InlineKeyboard().url('Pay now', payment.paymentUrl);
        await ctx.reply(
          `Payment ready.\nAmount: ${result.finalAmount}\nClick below to complete payment.`,
          { reply_markup: kb },
        );
      }
    } catch (err) {
      this.logger.error('startCheckout failed', err);
      const msg = err instanceof Error ? err.message : 'Payment error';
      await ctx.reply(`Error: ${msg}`);
    }
  }

  async handlePromoInput(ctx: Context, code: string): Promise<void> {
    const from = ctx.from;
    if (!from) return;
    const s = this.state.get(from.id);
    if (s.kind !== 'await_promo') return;
    this.state.clear(from.id);
    const trimmed = code.trim();
    if (trimmed === '/cancel' || trimmed.toLowerCase() === 'cancel') {
      await this.startCheckout(
        ctx,
        s.planId,
        s.provider as 'yookassa' | 'stars' | 'cryptobot' | 'balance',
      );
      return;
    }
    await this.startCheckout(
      ctx,
      s.planId,
      s.provider as 'yookassa' | 'stars' | 'cryptobot' | 'balance',
      trimmed,
    );
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
