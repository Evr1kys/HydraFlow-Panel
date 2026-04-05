import { client } from './client';
import type { Host } from '../types';

export interface HostListFilters {
  protocol?: string;
  enabled?: boolean;
  search?: string;
}

export interface CreateHostInput {
  remark: string;
  protocol: string;
  port: number;
  sni?: string;
  path?: string;
  host?: string;
  security?: string;
  flow?: string;
  fingerprint?: string;
  publicKey?: string;
  shortId?: string;
  alpn?: string[];
  network?: string;
  serviceName?: string;
  headerType?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export type UpdateHostInput = Partial<CreateHostInput>;

export async function getHosts(filters: HostListFilters = {}): Promise<Host[]> {
  const params: Record<string, string> = {};
  if (filters.protocol) params.protocol = filters.protocol;
  if (typeof filters.enabled === 'boolean')
    params.enabled = String(filters.enabled);
  if (filters.search) params.search = filters.search;
  const response = await client.get<Host[]>('/hosts', { params });
  return response.data;
}

export async function getHost(id: string): Promise<Host> {
  const response = await client.get<Host>(`/hosts/${id}`);
  return response.data;
}

export async function createHost(data: CreateHostInput): Promise<Host> {
  const response = await client.post<Host>('/hosts', data);
  return response.data;
}

export async function updateHost(
  id: string,
  data: UpdateHostInput,
): Promise<Host> {
  const response = await client.patch<Host>(`/hosts/${id}`, data);
  return response.data;
}

export async function deleteHost(id: string): Promise<void> {
  await client.delete(`/hosts/${id}`);
}

export async function linkHostToNode(
  hostId: string,
  nodeId: string,
): Promise<void> {
  await client.post(`/hosts/${hostId}/link/${nodeId}`);
}

export async function unlinkHostFromNode(
  hostId: string,
  nodeId: string,
): Promise<void> {
  await client.delete(`/hosts/${hostId}/link/${nodeId}`);
}

export async function getHostsByNode(nodeId: string): Promise<Host[]> {
  const response = await client.get<Host[]>(`/hosts/by-node/${nodeId}`);
  return response.data;
}

export async function bulkEnableHosts(ids: string[]): Promise<void> {
  await client.post('/hosts/bulk/enable', { ids });
}

export async function bulkDisableHosts(ids: string[]): Promise<void> {
  await client.post('/hosts/bulk/disable', { ids });
}

export async function bulkDeleteHosts(ids: string[]): Promise<void> {
  await client.post('/hosts/bulk/delete', { ids });
}
