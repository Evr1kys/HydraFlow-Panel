import { client } from './client';
import type { IntelligenceEntry, Alert } from '../types';

export async function getIntelligence(
  country?: string,
): Promise<IntelligenceEntry[]> {
  const params = country ? { country } : {};
  const response = await client.get<IntelligenceEntry[]>('/intelligence', {
    params,
  });
  return response.data;
}

export async function submitReport(data: {
  country: string;
  isp: string;
  protocol: string;
  status: string;
  asn?: number;
}): Promise<void> {
  await client.post('/intelligence/report', data);
}

export async function getAlerts(): Promise<Alert[]> {
  const response = await client.get<Alert[]>('/alerts');
  return response.data;
}
