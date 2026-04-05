export interface PaymentMetadata {
  userId: string;
  plan: string;
  subscriptionId: string;
  returnUrl?: string;
  description?: string;
  [key: string]: unknown;
}

export interface CreatePaymentResult {
  externalId: string;
  confirmationUrl: string | null;
  status: string; // pending | succeeded | canceled
  raw: unknown;
}

export interface WebhookResult {
  externalId: string;
  status: 'succeeded' | 'pending' | 'failed' | 'canceled';
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: 'yookassa' | 'stripe' | 'crypto';

  createPayment(
    amount: number,
    currency: string,
    metadata: PaymentMetadata,
  ): Promise<CreatePaymentResult>;

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): boolean;

  handleWebhook(body: unknown): WebhookResult;
}
