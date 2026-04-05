export interface CreatePaymentParams {
  transactionId: string;
  amount: number;
  currency: string;
  description: string;
  telegramId: number;
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  /** Provider-specific payment id (YooKassa id, CryptoBot invoice id, Stars invoice payload) */
  providerPaymentId: string;
  /** URL to redirect user to, or null for in-telegram flow (Stars) */
  paymentUrl: string | null;
  /** Optional: pre-formatted Telegram invoice parameters for Stars */
  telegramInvoice?: {
    title: string;
    description: string;
    payload: string;
    currency: string;
    prices: Array<{ label: string; amount: number }>;
    providerToken: string;
  };
}

export interface PaymentProvider {
  readonly name: string;
  /** Whether this provider is configured and usable. */
  isEnabled(): boolean;
  /** Create a payment / invoice and return redirect/payment URL. */
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
}
