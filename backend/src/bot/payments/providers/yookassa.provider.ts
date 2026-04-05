import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
}

@Injectable()
export class YooKassaProvider implements PaymentProvider {
  readonly name = 'yookassa';
  private readonly logger = new Logger(YooKassaProvider.name);
  private readonly shopId: string | undefined;
  private readonly secretKey: string | undefined;
  private readonly apiUrl = 'https://api.yookassa.ru/v3/payments';

  constructor(private readonly config: ConfigService) {
    this.shopId = this.config.get<string>('YOOKASSA_SHOP_ID');
    this.secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY');
  }

  isEnabled(): boolean {
    return Boolean(this.shopId && this.secretKey);
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!this.shopId || !this.secretKey) {
      throw new Error('YooKassa not configured');
    }

    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString(
      'base64',
    );
    const idempotenceKey = randomUUID();

    const body = {
      amount: {
        value: params.amount.toFixed(2),
        currency: params.currency,
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url:
          params.returnUrl ??
          `https://t.me/${this.config.get<string>('TELEGRAM_BOT_USERNAME', 'hydraflow_bot')}`,
      },
      description: params.description,
      metadata: {
        transactionId: params.transactionId,
        telegramId: String(params.telegramId),
        ...(params.metadata ?? {}),
      },
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `YooKassa create payment failed: ${response.status} ${text}`,
      );
      throw new Error(`YooKassa API error: ${response.status}`);
    }

    const data = (await response.json()) as YooKassaPaymentResponse;
    const url = data.confirmation?.confirmation_url;
    if (!url) {
      throw new Error('YooKassa response missing confirmation_url');
    }

    return {
      providerPaymentId: data.id,
      paymentUrl: url,
    };
  }
}
