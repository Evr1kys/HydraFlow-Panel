import { client } from './client';
import type { ConfigProfile } from '../types';

export async function getConfigProfiles(): Promise<ConfigProfile[]> {
  const response = await client.get<ConfigProfile[]>('/config-profiles');
  return response.data;
}

export async function createConfigProfile(data: {
  name: string;
  config: string;
}): Promise<ConfigProfile> {
  const response = await client.post<ConfigProfile>('/config-profiles', data);
  return response.data;
}

export async function deleteConfigProfile(id: string): Promise<void> {
  await client.delete(`/config-profiles/${id}`);
}

export async function setDefaultProfile(id: string): Promise<ConfigProfile> {
  const response = await client.post<ConfigProfile>(`/config-profiles/${id}/default`);
  return response.data;
}
