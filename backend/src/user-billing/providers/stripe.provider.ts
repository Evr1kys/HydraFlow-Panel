import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  CreatePaymentResult,
  PaymentMetadata,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

/**
 * Stripe Checkout Sessions client.
 * Uses Bearer auth with STRIPE_SECRET_KEY.
 * Docs: https://stripe.com/docs/api/checkout/sessions
 */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly logger = new Logger(StripeProvider.name);
  private readonly apiUrl = 'https://api.stripe.com/v1/checkout/sessions';

  async createPayment(
    amount: number,
    currency: string,
    metadata: PaymentMetadata,
  ): Promise<CreatePaymentResult> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    // Stripe expects amount in minor units (cents).
    const unitAmount = Math.round(amount * 100);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', metadata.returnUrl ?? 'https://example.com/return?success=1');
    params.append('cancel_url', metadata.returnUrl ?? 'https://example.com/return?cancel=1');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', currency.toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
    params.append(
      'line_items[0][price_data][product_data][name]',
      metadata.description ?? `Subscription ${metadata.plan}`,
    );
    params.append('metadata[userId]', metadata.userId);
    params.append('metadata[plan]', metadata.plan);
    params.append('metadata[subscriptionId]', metadata.subscriptionId);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${secret}`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`Stripe createPayment failed ${response.status}: ${text}`);
      throw new Error(`Stripe error ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      url: string | null;
      status: string;
    };

    return {
      externalId: data.id,
      confirmationUrl: data.url,
      status: data.status,
      raw: data,
    };
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      // If no webhook secret configured, skip verification (dev only).
      return true;
    }
    const sigHeader = headers['stripe-signature'];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!sig) return false;

    // Parse the header: t=<ts>,v1=<sig>
    const parts = sig.split(',').reduce<Record<string, string>>((acc, pair) => {
      const [k, v] = pair.split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts['t'];
    const expectedSig = parts['v1'];
    if (!timestamp || !expectedSig) return false;

    const signedPayload = `${timestamp}.${rawBody}`;
    const computed = createHmac('sha256', secret).update(signedPayload).digest('hex');

    try {
      const a = Buffer.from(computed, 'hex');
      const b = Buffer.from(expectedSig, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  handleWebhook(body: unknown): WebhookResult {
    const payload = body as {
      type: string;
      data: { object: Record<string, unknown> };
    };
    const obj = payload?.data?.object;
    if (!obj) {
      throw new Error('Invalid Stripe webhook payload');
    }

    const id = (obj.id as string) ?? '';
    const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
    const paymentStatus = obj.payment_status as string | undefined;

    let status: WebhookResult['status'] = 'pending';
    if (
      payload.type === 'checkout.session.completed' &&
      paymentStatus === 'paid'
    ) {
      status = 'succeeded';
    } else if (payload.type === 'checkout.session.expired') {
      status = 'canceled';
    } else if (payload.type === 'payment_intent.payment_failed') {
      status = 'failed';
    }

    const amountTotal = obj.amount_total as number | undefined;
    const currency = obj.currency as string | undefined;

    return {
      externalId: id,
      status,
      subscriptionId: metadata.subscriptionId,
      amount: amountTotal !== undefined ? amountTotal / 100 : undefined,
      currency: currency?.toUpperCase(),
      raw: payload,
    };
  }
}
