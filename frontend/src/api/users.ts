import { api } from './client';

export interface User {
  id: string; email: string; uuid: string; subToken: string; enabled: boolean;
  trafficUp: string; trafficDown: string; trafficLimit: string | null;
  expiryDate: string | null; createdAt: string; updatedAt: string;
}

export async function getUsers(): Promise<User[]> { return (await api.get<User[]>('/users')).data; }
export async function createUser(email: string, trafficLimit?: string, expiryDate?: string) { return (await api.post<User>('/users', { email, trafficLimit, expiryDate })).data; }
export async function updateUser(id: string, data: Partial<Pick<User, 'email' | 'enabled'> & { trafficLimit?: string; expiryDate?: string }>) { return (await api.patch<User>(`/users/${id}`, data)).data; }
export async function deleteUser(id: string) { return (await api.delete(`/users/${id}`)).data; }
export async function toggleUser(id: string) { return (await api.post<User>(`/users/${id}/toggle`)).data; }
export async function getUserSubscription(id: string) { return (await api.get<{ subToken: string; subscriptionUrl: string }>(`/users/${id}/subscription`)).data; }
