import { client } from './client';
import type { InternalSquad, ExternalSquad } from '../types';

// --- Internal Squads ---

export async function getInternalSquads(): Promise<InternalSquad[]> {
  const response = await client.get<InternalSquad[]>('/squads/internal');
  return response.data;
}

export async function createInternalSquad(data: {
  name: string;
  description?: string;
  nodeIds?: string[];
}): Promise<InternalSquad> {
  const response = await client.post<InternalSquad>('/squads/internal', data);
  return response.data;
}

export async function updateInternalSquad(
  id: string,
  data: { name?: string; description?: string; nodeIds?: string[] },
): Promise<InternalSquad> {
  const response = await client.patch<InternalSquad>(`/squads/internal/${id}`, data);
  return response.data;
}

export async function deleteInternalSquad(id: string): Promise<void> {
  await client.delete(`/squads/internal/${id}`);
}

export async function assignUsersToSquad(
  squadId: string,
  userIds: string[],
): Promise<InternalSquad> {
  const response = await client.post<InternalSquad>(
    `/squads/internal/${squadId}/users`,
    { userIds },
  );
  return response.data;
}

export async function removeUsersFromSquad(
  squadId: string,
  userIds: string[],
): Promise<InternalSquad> {
  const response = await client.delete<InternalSquad>(
    `/squads/internal/${squadId}/users`,
    { data: { userIds } },
  );
  return response.data;
}

// --- External Squads ---

export async function getExternalSquads(): Promise<ExternalSquad[]> {
  const response = await client.get<ExternalSquad[]>('/squads/external');
  return response.data;
}

export async function createExternalSquad(data: {
  name: string;
  maxUsers?: number;
  hostOverrides?: Record<string, string>;
  enabled?: boolean;
  subPageTitle?: string;
  subPageBrand?: string;
}): Promise<ExternalSquad> {
  const response = await client.post<ExternalSquad>('/squads/external', data);
  return response.data;
}

export async function updateExternalSquad(
  id: string,
  data: {
    name?: string;
    maxUsers?: number;
    hostOverrides?: Record<string, string>;
    enabled?: boolean;
    subPageTitle?: string;
    subPageBrand?: string;
  },
): Promise<ExternalSquad> {
  const response = await client.patch<ExternalSquad>(`/squads/external/${id}`, data);
  return response.data;
}

export async function deleteExternalSquad(id: string): Promise<void> {
  await client.delete(`/squads/external/${id}`);
}

export async function regenerateExternalApiKey(id: string): Promise<ExternalSquad> {
  const response = await client.post<ExternalSquad>(
    `/squads/external/${id}/regenerate-key`,
  );
  return response.data;
}
