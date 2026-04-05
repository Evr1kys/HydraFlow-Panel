import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

interface CryptoBotInvoiceResponse {
  ok: boolean;
  result?: {
    invoice_id: number;
    pay_url: string;
    bot_invoice_url?: string;
  };
  error?: { code: number; name: string };
}

@Injectable()
export class CryptoBotProvider implements PaymentProvider {
  readonly name = 'cryptobot';
  private readonly logger = new Logger(CryptoBotProvider.name);
  private readonly token: string | undefined;
  private readonly apiUrl = 'https://pay.crypt.bot/api/createInvoice';

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('CRYPTOBOT_TOKEN');
  }

  isEnabled(): boolean {
    return Boolean(this.token);
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    if (!this.token) {
      throw new Error('CryptoBot not configured');
    }

    // CryptoBot supports USDT, TON, BTC, ETH. Amount comes in the transaction currency,
    // so we just pass it through as USDT for now (simplification — caller ensures USD amount).
    const body = {
      asset: 'USDT',
      amount: params.amount.toFixed(2),
      description: params.description,
      payload: params.transactionId,
      allow_comments: false,
      allow_anonymous: true,
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Crypto-Pay-API-Token': this.token,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as CryptoBotInvoiceResponse;
    if (!data.ok || !data.result) {
      this.logger.error(
        `CryptoBot create invoice failed: ${JSON.stringify(data.error ?? data)}`,
      );
      throw new Error(`CryptoBot API error: ${data.error?.name ?? 'unknown'}`);
    }

    return {
      providerPaymentId: String(data.result.invoice_id),
      paymentUrl: data.result.bot_invoice_url ?? data.result.pay_url,
    };
  }
}
