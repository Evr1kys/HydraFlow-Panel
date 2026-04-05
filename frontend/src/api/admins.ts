import { client } from './client';

export type AdminRole = 'superadmin' | 'admin' | 'operator' | 'readonly';

export interface AdminEntry {
  id: string;
  email: string;
  role: AdminRole;
  enabled: boolean;
  lastLoginAt: string | null;
  totpEnabled: boolean;
  createdAt: string;
}

export async function listAdmins(): Promise<AdminEntry[]> {
  const response = await client.get<AdminEntry[]>('/admins');
  return response.data;
}

export async function createAdmin(data: {
  email: string;
  password: string;
  role?: AdminRole;
}): Promise<AdminEntry> {
  const response = await client.post<AdminEntry>('/admins', data);
  return response.data;
}

export async function updateAdmin(
  id: string,
  data: { role?: AdminRole; enabled?: boolean },
): Promise<AdminEntry> {
  const response = await client.patch<AdminEntry>(`/admins/${id}`, data);
  return response.data;
}

export async function resetAdminPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  await client.post(`/admins/${id}/reset-password`, { newPassword });
}

export async function deleteAdmin(id: string): Promise<void> {
  await client.delete(`/admins/${id}`);
}
