import { client } from './client';

export async function login(
  email: string,
  password: string,
): Promise<string> {
  const response = await client.post<{ token: string }>('/auth/login', {
    email,
    password,
  });
  return response.data.token;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await client.post('/auth/change-password', {
    currentPassword,
    newPassword,
  });
}
