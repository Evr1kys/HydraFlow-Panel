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

// --- OAuth ---

export interface OAuthProvider {
  provider: string;
  enabled: boolean;
}

export async function getOAuthProviders(): Promise<OAuthProvider[]> {
  const response = await client.get<OAuthProvider[]>('/auth/oauth/providers');
  return response.data;
}

export async function telegramLogin(
  data: Record<string, unknown>,
): Promise<string> {
  const response = await client.post<{ token: string }>(
    '/auth/oauth/telegram/callback',
    data,
  );
  return response.data.token;
}

export interface OAuthAccount {
  id: string;
  provider: string;
  providerId: string;
  email: string | null;
  createdAt: string;
}

export async function getLinkedOAuthAccounts(): Promise<OAuthAccount[]> {
  const response = await client.get<OAuthAccount[]>('/auth/oauth/accounts');
  return response.data;
}

export async function unlinkOAuthAccount(accountId: string): Promise<void> {
  await client.post('/auth/oauth/unlink', { accountId });
}

// --- Passkeys ---

export async function getPasskeyRegisterOptions(): Promise<unknown> {
  const response = await client.post('/auth/passkeys/register-options');
  return response.data;
}

export async function verifyPasskeyRegister(
  credential: unknown,
): Promise<{ verified: boolean }> {
  const response = await client.post<{ verified: boolean }>(
    '/auth/passkeys/register-verify',
    credential,
  );
  return response.data;
}

export async function getPasskeyLoginOptions(): Promise<unknown> {
  const response = await client.post('/auth/passkeys/login-options');
  return response.data;
}

export async function verifyPasskeyLogin(
  credential: unknown,
): Promise<string> {
  const response = await client.post<{ token: string }>(
    '/auth/passkeys/login-verify',
    credential,
  );
  return response.data.token;
}

export interface PasskeyInfo {
  id: string;
  credentialId: string;
  transports: string[];
  createdAt: string;
}

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  const response = await client.get<PasskeyInfo[]>('/auth/passkeys');
  return response.data;
}

export async function deletePasskey(id: string): Promise<void> {
  await client.delete(`/auth/passkeys/${id}`);
}
