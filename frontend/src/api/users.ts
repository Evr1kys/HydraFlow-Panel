import { client } from './client';
import type { User } from '../types';

export async function getUsers(): Promise<User[]> {
  const response = await client.get<User[]>('/users');
  return response.data;
}

export async function createUser(data: {
  email: string;
  remark?: string;
  trafficLimit?: number;
  expiryDate?: string;
}): Promise<User> {
  const response = await client.post<User>('/users', data);
  return response.data;
}

export async function updateUser(
  id: string,
  data: Partial<User>,
): Promise<User> {
  const response = await client.patch<User>(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`);
}

export async function toggleUser(id: string): Promise<User> {
  const response = await client.post<User>(`/users/${id}/toggle`);
  return response.data;
}

export async function bulkEnableUsers(ids: string[]): Promise<{ count: number }> {
  const response = await client.post<{ count: number }>('/users/bulk/enable', { ids });
  return response.data;
}

export async function bulkDisableUsers(ids: string[]): Promise<{ count: number }> {
  const response = await client.post<{ count: number }>('/users/bulk/disable', { ids });
  return response.data;
}

export async function bulkDeleteUsers(ids: string[]): Promise<{ count: number }> {
  const response = await client.delete<{ count: number }>('/users/bulk', { data: { ids } });
  return response.data;
}

export async function renewUser(id: string, days: number): Promise<User> {
  const response = await client.post<User>(`/users/${id}/renew`, { days });
  return response.data;
}

export async function resetUserTraffic(id: string): Promise<User> {
  const response = await client.post<User>(`/users/${id}/reset-traffic`);
  return response.data;
}
