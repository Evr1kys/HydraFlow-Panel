import { client } from './client';
import type { Settings } from '../types';

export async function getSettings(): Promise<Settings> {
  const response = await client.get<Settings>('/settings');
  return response.data;
}

export async function updateSettings(
  data: Partial<Settings>,
): Promise<Settings> {
  const response = await client.patch<Settings>('/settings', data);
  return response.data;
}
