import { client } from './client';
import type { Webhook } from '../types';

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
