import { client } from './client';
import type { User, UserDevice, TrafficStrategy } from '../types';

export async function getUsers(): Promise<User[]> {
  const response = await client.get<User[]>('/users');
  return response.data;
}

export async function createUser(data: {
  email: string;
  remark?: string;
  trafficLimit?: number;
  expiryDate?: string;
  tag?: string;
  trafficStrategy?: TrafficStrategy;
  hwidDeviceLimit?: number;
  shortUuid?: string;
}): Promise<User> {
  const response = await client.post<User>('/users', data);
  return response.data;
}

export async function updateUser(
  id: string,
  data: Partial<{
    email: string;
    enabled: boolean;
    remark: string | null;
    trafficLimit: number | null;
    expiryDate: string | null;
    tag: string | null;
    trafficStrategy: TrafficStrategy;
    hwidDeviceLimit: number | null;
    shortUuid: string;
  }>,
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

export async function getUserTags(): Promise<string[]> {
  const response = await client.get<string[]>('/users/tags');
  return response.data;
}

export async function getUserByShortUuid(shortUuid: string): Promise<User> {
  const response = await client.get<User>(`/users/by-short-uuid/${shortUuid}`);
  return response.data;
}

export async function getUsersByTag(tag: string): Promise<User[]> {
  const response = await client.get<User[]>(`/users/by-tag/${encodeURIComponent(tag)}`);
  return response.data;
}

export async function getUserByTelegramId(tgId: string): Promise<User> {
  const response = await client.get<User>(`/users/by-telegram-id/${tgId}`);
  return response.data;
}

export async function getUserDevices(id: string): Promise<UserDevice[]> {
  const response = await client.get<UserDevice[]>(`/users/${id}/devices`);
  return response.data;
}

export async function removeUserDevice(
  id: string,
  deviceId: string,
): Promise<void> {
  await client.delete(`/users/${id}/devices/${deviceId}`);
}

export async function revokeUserSubscription(id: string): Promise<User> {
  const response = await client.post<User>(`/users/${id}/revoke-subscription`);
  return response.data;
}
