import { Injectable } from '@nestjs/common';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Telegram Stars provider. No external API — invoice is built in-bot via sendInvoice.
 * We return an empty paymentUrl; the caller must detect provider==='stars' and
 * use telegramInvoice data to call ctx.replyWithInvoice().
 */
@Injectable()
export class TelegramStarsProvider implements PaymentProvider {
  readonly name = 'stars';

  isEnabled(): boolean {
    // Stars is always available if the bot token is set.
    return true;
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    // For Stars, amount is an integer number of stars.
    const starsAmount = Math.max(1, Math.round(params.amount));

    return {
      providerPaymentId: params.transactionId,
      paymentUrl: null,
      telegramInvoice: {
        title: params.description.slice(0, 32) || 'Subscription',
        description: params.description.slice(0, 255),
        payload: params.transactionId,
        currency: 'XTR',
        prices: [{ label: params.description.slice(0, 32), amount: starsAmount }],
        providerToken: '',
      },
    };
  }
}
