import { client } from './client';
import type { Webhook } from '../types';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: 'pending' | 'success' | 'failed' | 'dead';
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WebhookDeliveryStats {
  pending: number;
  success: number;
  failed: number;
  dead: number;
}

export async function getWebhooks(): Promise<Webhook[]> {
  const response = await client.get<Webhook[]>('/webhooks');
  return response.data;
}

export async function createWebhook(data: {
  url: string;
  events: string[];
  secret: string;
}): Promise<Webhook> {
  const response = await client.post<Webhook>('/webhooks', data);
  return response.data;
}

export async function deleteWebhook(id: string): Promise<void> {
  await client.delete(`/webhooks/${id}`);
}

export async function getWebhookDeliveries(
  webhookId: string,
  limit = 20,
): Promise<WebhookDelivery[]> {
  const response = await client.get<WebhookDelivery[]>(
    `/webhooks/${webhookId}/deliveries`,
    { params: { limit } },
  );
  return response.data;
}

export async function retryWebhookDelivery(
  webhookId: string,
  deliveryId: string,
): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>(
    `/webhooks/${webhookId}/deliveries/${deliveryId}/retry`,
  );
  return response.data;
}

export async function getWebhookDeliveryStats(): Promise<WebhookDeliveryStats> {
  const response = await client.get<WebhookDeliveryStats>(
    '/webhooks/deliveries/stats',
  );
  return response.data;
}
