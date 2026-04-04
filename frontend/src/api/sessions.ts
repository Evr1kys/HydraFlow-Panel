import { client } from './client';
import type { Session } from '../types';

export async function getSessions(): Promise<Session[]> {
  const response = await client.get<Session[]>('/auth/sessions');
  return response.data;
}

export async function revokeSession(id: string): Promise<void> {
  await client.delete(`/auth/sessions/${id}`);
}
