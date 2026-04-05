import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Heleket (formerly Cryptomus merchant) crypto payment provider.
 * API docs: https://doc.heleket.com/
 *
 * Signature algorithm:
 *   sign = md5(base64(JSON.stringify(sorted_data)) + api_key)
 */
@Injectable()
export class HeleketProvider implements PaymentProvider {
  readonly name = 'heleket';
  private readonly logger = new Logger(HeleketProvider.name);
  private readonly merchantId: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly apiBase: string;
  private readonly callbackUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.merchantId = this.config.get<string>('HELEKET_MERCHANT_ID');
    this.apiKey = this.config.get<string>('HELEKET_API_KEY');
    this.apiBase = (
      this.config.get<string>('HELEKET_API_BASE') || 'https://api.heleket.com'
    ).replace(/\/$/, '');
    const publicBase = this.config.get<string>('PUBLIC_BASE_URL');
    this.callbackUrl = publicBase
      ? `${publicBase.replace(/\/$/, '')}/api/bot/webhook/heleket`
      : undefined;
  }

  isEnabled(): boolean {
    return Boolean(this.merchantId && this.apiKey);
  }

  /** Generate HMAC-style signature required by Heleket. */
  private sign(data: Record<string, unknown>): string {
    // Heleket: md5(base64(JSON with sorted keys) + api_key)
    const sorted = this.sortKeys(data);
    const body = JSON.stringify(sorted);
    const base64 = Buffer.from(body).toString('base64');
    return crypto
      .createHash('md5')
      .update(base64 + this.apiKey)
      .digest('hex');
  }

  private sortKeys(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map((v) => this.sortKeys(v));
    if (obj && typeof obj === 'object') {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
        sorted[key] = this.sortKeys((obj as Record<string, unknown>)[key]);
      }
      return sorted;
    }
    return obj;
  }

  /**
   * Verify webhook signature from Heleket callback.
   * Caller must strip the 'sign' field from the body before passing.
   */
  verifyWebhook(bodyWithoutSign: Record<string, unknown>, sign: string): boolean {
    if (!this.apiKey) return false;
    const expected = this.sign(bodyWithoutSign);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(sign),
      );
    } catch {
      return false;
    }
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    if (!this.isEnabled()) {
      throw new Error('Heleket provider is not configured');
    }

    const metadata: Record<string, unknown> = {
      transactionId: params.transactionId,
      telegramId: params.telegramId,
      priceAmount: params.amount,
      priceCurrency: params.currency,
      ...(params.metadata ?? {}),
    };

    const data: Record<string, unknown> = {
      merchant_id: this.merchantId,
      order_id: params.transactionId,
      amount: Number(params.amount),
      currency: params.currency,
      description: JSON.stringify(metadata),
      lifetime: 1800, // invoice valid 30 min
    };
    if (this.callbackUrl) data['callback_url'] = this.callbackUrl;
    if (params.returnUrl) data['success_url'] = params.returnUrl;

    const payload = { ...data, sign: this.sign(data) };

    try {
      const resp = await fetch(`${this.apiBase}/invoice/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const text = await resp.text();
      if (!resp.ok) {
        this.logger.error(
          `Heleket create invoice failed [${resp.status}]: ${text}`,
        );
        throw new Error(
          `Heleket API returned ${resp.status}: ${text.slice(0, 200)}`,
        );
      }

      const json = JSON.parse(text) as {
        payment_url?: string;
        pay_url?: string;
        url?: string;
        uuid?: string;
        order_id?: string;
      };
      const paymentUrl = json.payment_url || json.pay_url || json.url;
      if (!paymentUrl) {
        this.logger.error(`Heleket response missing URL: ${text}`);
        throw new Error('Heleket did not return a payment URL');
      }
      return {
        providerPaymentId: json.uuid || json.order_id || params.transactionId,
        paymentUrl,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Heleket createPayment error: ${msg}`);
      throw err;
    }
  }
}
