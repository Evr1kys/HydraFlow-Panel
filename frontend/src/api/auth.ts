import { api } from './client';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  admin: { id: string; email: string };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', { email, password });
  return res.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await api.post('/auth/change-password', { currentPassword, newPassword });
  return res.data;
}
