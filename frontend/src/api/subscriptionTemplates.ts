import { client } from './client';
import type { SubscriptionTemplate } from '../types';

export interface CreateSubscriptionTemplateInput {
  name: string;
  clientType: string;
  template: string;
  isDefault?: boolean;
  enabled?: boolean;
}

export type UpdateSubscriptionTemplateInput =
  Partial<CreateSubscriptionTemplateInput>;

export async function getSubscriptionTemplates(
  clientType?: string,
): Promise<SubscriptionTemplate[]> {
  const params: Record<string, string> = {};
  if (clientType) params.clientType = clientType;
  const response = await client.get<SubscriptionTemplate[]>(
    '/subscription-templates',
    { params },
  );
  return response.data;
}

export async function getSubscriptionTemplate(
  id: string,
): Promise<SubscriptionTemplate> {
  const response = await client.get<SubscriptionTemplate>(
    `/subscription-templates/${id}`,
  );
  return response.data;
}

export async function createSubscriptionTemplate(
  data: CreateSubscriptionTemplateInput,
): Promise<SubscriptionTemplate> {
  const response = await client.post<SubscriptionTemplate>(
    '/subscription-templates',
    data,
  );
  return response.data;
}

export async function updateSubscriptionTemplate(
  id: string,
  data: UpdateSubscriptionTemplateInput,
): Promise<SubscriptionTemplate> {
  const response = await client.patch<SubscriptionTemplate>(
    `/subscription-templates/${id}`,
    data,
  );
  return response.data;
}

export async function deleteSubscriptionTemplate(id: string): Promise<void> {
  await client.delete(`/subscription-templates/${id}`);
}

export async function setDefaultSubscriptionTemplate(
  id: string,
): Promise<SubscriptionTemplate> {
  const response = await client.post<SubscriptionTemplate>(
    `/subscription-templates/${id}/default`,
  );
  return response.data;
}

export async function previewSubscriptionTemplate(
  id: string,
  userId: string,
): Promise<{ content: string }> {
  const response = await client.post<{ content: string }>(
    `/subscription-templates/${id}/preview`,
    { userId },
  );
  return response.data;
}
