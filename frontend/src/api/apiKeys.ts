import { client } from './client';

export type ApiKeyScope =
  | 'users:read'
  | 'users:write'
  | 'nodes:read'
  | 'nodes:write'
  | 'stats:read'
  | 'admin:all';

export const ALL_API_KEY_SCOPES: ApiKeyScope[] = [
  'users:read',
  'users:write',
  'nodes:read',
  'nodes:write',
  'stats:read',
  'admin:all',
];

export interface ApiKeyEntry {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface ApiKeyWithPlaintext extends ApiKeyEntry {
  key: string;
}

export async function listApiKeys(): Promise<ApiKeyEntry[]> {
  const response = await client.get<ApiKeyEntry[]>('/api-keys');
  return response.data;
}

export async function createApiKey(data: {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
}): Promise<ApiKeyWithPlaintext> {
  const response = await client.post<ApiKeyWithPlaintext>('/api-keys', data);
  return response.data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await client.delete(`/api-keys/${id}`);
}
