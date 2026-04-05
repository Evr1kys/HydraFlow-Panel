import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  CreatePaymentResult,
  PaymentMetadata,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

type YooKassaPaymentResponse = {
  id: string;
  status: string;
  confirmation?: { confirmation_url?: string };
  amount?: { value: string; currency: string };
  metadata?: Record<string, string>;
};

type YooKassaWebhookBody = {
  event: string;
  object: YooKassaPaymentResponse;
};

/**
 * YooKassa API client.
 * Uses HTTP Basic Auth: base64(shopId:secretKey).
 * Docs: https://yookassa.ru/developers/api
 */
@Injectable()
export class YooKassaProvider implements PaymentProvider {
  readonly name = 'yookassa' as const;
  private readonly logger = new Logger(YooKassaProvider.name);
  private readonly apiUrl = 'https://api.yookassa.ru/v3/payments';

  private getAuthHeader(): string | null {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) return null;
    return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  }

  async createPayment(
    amount: number,
    currency: string,
    metadata: PaymentMetadata,
  ): Promise<CreatePaymentResult> {
    const auth = this.getAuthHeader();
    if (!auth) {
      throw new Error('YooKassa credentials not configured');
    }

    const body = {
      amount: {
        value: amount.toFixed(2),
        currency: currency.toUpperCase(),
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: metadata.returnUrl ?? 'https://example.com/return',
      },
      description: metadata.description ?? `Subscription ${metadata.plan}`,
      metadata: {
        userId: metadata.userId,
        plan: metadata.plan,
        subscriptionId: metadata.subscriptionId,
      },
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
        'Idempotence-Key': randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`YooKassa createPayment failed ${response.status}: ${text}`);
      throw new Error(`YooKassa error ${response.status}`);
    }

    const data = (await response.json()) as YooKassaPaymentResponse;
    return {
      externalId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url ?? null,
      status: data.status,
      raw: data,
    };
  }

  verifyWebhook(
    _headers: Record<string, string | string[] | undefined>,
    _rawBody: string,
  ): boolean {
    // YooKassa does not sign webhooks by default. Production should
    // restrict callbacks by source IP (whitelist) and verify payment
    // status via GET /payments/:id. For now we trust the payload and
    // re-verify status server-side when handling.
    return true;
  }

  handleWebhook(body: unknown): WebhookResult {
    const payload = body as YooKassaWebhookBody;
    const obj = payload?.object;
    if (!obj || !obj.id) {
      throw new Error('Invalid YooKassa webhook payload');
    }

    let status: WebhookResult['status'] = 'pending';
    if (obj.status === 'succeeded') status = 'succeeded';
    else if (obj.status === 'canceled') status = 'canceled';
    else if (obj.status === 'waiting_for_capture') status = 'pending';
    else if (obj.status === 'pending') status = 'pending';

    return {
      externalId: obj.id,
      status,
      subscriptionId: obj.metadata?.subscriptionId,
      amount: obj.amount ? Number(obj.amount.value) : undefined,
      currency: obj.amount?.currency,
      raw: payload,
    };
  }
}
