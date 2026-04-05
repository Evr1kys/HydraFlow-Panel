import { client } from './client';

export type PaymentProviderName = 'yookassa' | 'stripe' | 'crypto';

export interface UserSubscription {
  id: string;
  userId: string;
  plan: string;
  priceAmount: number;
  priceCurrency: string;
  provider: string;
  externalId: string | null;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  trafficGb: number | null;
  daysDuration: number;
  startDate: string;
  endDate: string | null;
  cancelledAt: string | null;
  autoRenew: boolean;
  createdAt: string;
}

export interface CheckoutResponse {
  subscriptionId: string;
  provider: PaymentProviderName;
  externalId: string;
  confirmationUrl: string | null;
  status: string;
}

export interface CreateCheckoutData {
  userId: string;
  plan: string;
  priceAmount: number;
  priceCurrency?: string;
  provider: PaymentProviderName;
  daysDuration: number;
  trafficGb?: number;
  returnUrl?: string;
  description?: string;
}

export async function createCheckout(
  data: CreateCheckoutData,
): Promise<CheckoutResponse> {
  const response = await client.post<CheckoutResponse>(
    '/user-billing/checkout',
    data,
  );
  return response.data;
}

export async function listAllSubscriptions(): Promise<UserSubscription[]> {
  const response = await client.get<UserSubscription[]>(
    '/user-billing/subscriptions',
  );
  return response.data;
}

export async function getUserSubscriptions(
  userId: string,
): Promise<UserSubscription[]> {
  const response = await client.get<UserSubscription[]>(
    `/user-billing/my-subscription/${userId}`,
  );
  return response.data;
}

export async function manualConfirmSubscription(
  subscriptionId: string,
): Promise<UserSubscription> {
  const response = await client.post<UserSubscription>(
    '/user-billing/manual-confirm',
    { subscriptionId },
  );
  return response.data;
}

export async function cancelSubscription(
  id: string,
): Promise<UserSubscription> {
  const response = await client.post<UserSubscription>(
    `/user-billing/subscriptions/${id}/cancel`,
  );
  return response.data;
}
