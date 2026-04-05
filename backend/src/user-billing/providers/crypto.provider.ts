import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type {
  CreatePaymentResult,
  PaymentMetadata,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

/**
 * Crypto payment provider.
 *
 * Currently implemented as a manual-confirmation stub: createPayment
 * generates an invoice id; an admin marks it paid via the manual
 * confirm endpoint (POST /user-billing/manual-confirm/:subscriptionId).
 *
 * TODO: wire up NOWPayments (https://documenter.getpostman.com/view/7907941/2s93JusNJt)
 *   - POST https://api.nowpayments.io/v1/invoice with x-api-key header
 *   - Webhook HMAC-SHA512 signature verification via NOWPAYMENTS_IPN_SECRET
 *   - Accept pay_currency, price_amount, order_id in request
 */
@Injectable()
export class CryptoProvider implements PaymentProvider {
  readonly name = 'crypto' as const;
  private readonly logger = new Logger(CryptoProvider.name);

  async createPayment(
    amount: number,
    currency: string,
    metadata: PaymentMetadata,
  ): Promise<CreatePaymentResult> {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;

    if (!apiKey) {
      // Manual-confirmation stub: return a local invoice id.
      const invoiceId = `manual-${randomUUID()}`;
      this.logger.log(
        `Crypto manual invoice ${invoiceId} for ${amount} ${currency} (user=${metadata.userId}, plan=${metadata.plan})`,
      );
      return {
        externalId: invoiceId,
        confirmationUrl: null,
        status: 'pending',
        raw: { manual: true, amount, currency, metadata },
      };
    }

    // TODO: NOWPayments real implementation
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: currency.toLowerCase(),
        order_id: metadata.subscriptionId,
        order_description: metadata.description ?? `Subscription ${metadata.plan}`,
        ipn_callback_url: process.env.NOWPAYMENTS_CALLBACK_URL,
        success_url: metadata.returnUrl,
        cancel_url: metadata.returnUrl,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`NOWPayments createPayment failed ${response.status}: ${text}`);
      throw new Error(`NOWPayments error ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      invoice_url: string;
      order_id: string;
    };

    return {
      externalId: String(data.id),
      confirmationUrl: data.invoice_url,
      status: 'pending',
      raw: data,
    };
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): boolean {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    if (!ipnSecret) {
      // Manual stub mode: any webhook is fine (admin-triggered).
      return true;
    }
    const sigHeader = headers['x-nowpayments-sig'];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!sig) return false;

    try {
      // NOWPayments: HMAC-SHA512 of JSON-sorted body with IPN secret.
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      const sortedKeys = Object.keys(parsed).sort();
      const sortedJson = JSON.stringify(
        sortedKeys.reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = parsed[k];
          return acc;
        }, {}),
      );
      const computed = createHmac('sha512', ipnSecret)
        .update(sortedJson)
        .digest('hex');
      const a = Buffer.from(computed, 'hex');
      const b = Buffer.from(sig, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  handleWebhook(body: unknown): WebhookResult {
    const payload = body as {
      payment_id?: string | number;
      payment_status?: string;
      order_id?: string;
      price_amount?: number;
      price_currency?: string;
      subscriptionId?: string;
      status?: 'succeeded' | 'failed';
    };

    // Manual stub path: admin sends { subscriptionId, status }
    if (payload.subscriptionId) {
      return {
        externalId: `manual-${payload.subscriptionId}`,
        status: payload.status ?? 'succeeded',
        subscriptionId: payload.subscriptionId,
        raw: payload,
      };
    }

    // NOWPayments path
    const npStatus = payload.payment_status;
    let status: WebhookResult['status'] = 'pending';
    if (npStatus === 'finished' || npStatus === 'confirmed') status = 'succeeded';
    else if (npStatus === 'failed' || npStatus === 'expired') status = 'failed';
    else if (npStatus === 'canceled') status = 'canceled';

    return {
      externalId: String(payload.payment_id ?? ''),
      status,
      subscriptionId: payload.order_id,
      amount: payload.price_amount,
      currency: payload.price_currency?.toUpperCase(),
      raw: payload,
    };
  }
}
