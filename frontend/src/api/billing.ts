import { client } from './client';
import type {
  BillingProvider,
  BillingNode,
  BillingHistoryEntry,
  BillingSummary,
} from '../types';

export async function getBillingSummary(): Promise<BillingSummary> {
  const response = await client.get<BillingSummary>('/billing/summary');
  return response.data;
}

export async function getBillingProviders(): Promise<BillingProvider[]> {
  const response = await client.get<BillingProvider[]>('/billing/providers');
  return response.data;
}

export async function createBillingProvider(data: {
  name: string;
  apiUrl?: string;
  credentials?: string;
}): Promise<BillingProvider> {
  const response = await client.post<BillingProvider>('/billing/providers', data);
  return response.data;
}

export async function deleteBillingProvider(id: string): Promise<void> {
  await client.delete(`/billing/providers/${id}`);
}

export async function getBillingNodes(): Promise<BillingNode[]> {
  const response = await client.get<BillingNode[]>('/billing/nodes');
  return response.data;
}

export async function createBillingNode(data: {
  nodeId: string;
  providerId: string;
  monthlyRate: number;
  currency?: string;
  renewalDate?: string;
}): Promise<BillingNode> {
  const response = await client.post<BillingNode>('/billing/nodes', data);
  return response.data;
}

export async function deleteBillingNode(id: string): Promise<void> {
  await client.delete(`/billing/nodes/${id}`);
}

export async function getBillingHistory(
  billingNodeId?: string,
): Promise<BillingHistoryEntry[]> {
  const params = billingNodeId ? { billingNodeId } : {};
  const response = await client.get<BillingHistoryEntry[]>('/billing/history', {
    params,
  });
  return response.data;
}

export async function createBillingHistory(data: {
  billingNodeId: string;
  amount: number;
  currency?: string;
  date?: string;
  paid?: boolean;
}): Promise<BillingHistoryEntry> {
  const response = await client.post<BillingHistoryEntry>(
    '/billing/history',
    data,
  );
  return response.data;
}

export async function markHistoryPaid(id: string): Promise<BillingHistoryEntry> {
  const response = await client.post<BillingHistoryEntry>(
    `/billing/history/${id}/paid`,
  );
  return response.data;
}
