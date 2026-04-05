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

export interface EmailSettings {
  id: string;
  enabled: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  fromEmail: string | null;
  fromName: string;
  updatedAt: string;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const response = await client.get<EmailSettings>('/settings/email');
  return response.data;
}

export async function updateEmailSettings(
  data: Partial<Omit<EmailSettings, 'id' | 'updatedAt'>>,
): Promise<EmailSettings> {
  const response = await client.patch<EmailSettings>('/settings/email', data);
  return response.data;
}

export async function sendTestEmail(
  to: string,
): Promise<{ success: boolean }> {
  const response = await client.post<{ success: boolean }>('/email/test', {
    to,
  });
  return response.data;
}
