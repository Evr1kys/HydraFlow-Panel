import { client } from './client';
import type { ActiveSession, ActiveSessionCount } from '../types';

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const response = await client.get<ActiveSession[]>('/sessions/active');
  return response.data;
}

export async function getActiveSessionCount(): Promise<ActiveSessionCount> {
  const response = await client.get<ActiveSessionCount>('/sessions/count');
  return response.data;
}

export async function dropUserSessions(
  userId: string,
): Promise<{ message: string; droppedCount: number }> {
  const response = await client.post<{
    message: string;
    droppedCount: number;
  }>(`/sessions/drop/${userId}`);
  return response.data;
}

export async function dropSession(id: string): Promise<void> {
  await client.delete(`/sessions/${id}`);
}
