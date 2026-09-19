import { client } from './client';
import type { Node } from '../types';
import type { PaginationParams, PaginatedResult } from '../hooks/usePaginated';

export interface CreateNodeInput {
  name: string;
  address: string;
  port: number;
  keyId: string;
  apiKey: string;
  caCertificate?: string;
  serverName?: string;
  enabled?: boolean;
}

export interface NodeDeployment {
  id: string;
  nodeId: string;
  idempotencyKey: string;
  configHash: string;
  revision: string | null;
  status: string;
  error: string | null;
  initiatedBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export async function getNodes(): Promise<Node[]> {
  const response = await client.get<Node[]>('/nodes');
  return response.data;
}

export async function getNodesPaginated(
  params: PaginationParams,
): Promise<PaginatedResult<Node>> {
  const query: Record<string, string> = {
    start: String(params.start),
    size: String(params.size),
  };
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  if (params.search) query.search = params.search;
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== null && value !== '') {
        query[key] = String(value);
      }
    }
  }
  const response = await client.get<PaginatedResult<Node>>('/nodes/paginated', {
    params: query,
  });
  return response.data;
}

export async function createNode(data: CreateNodeInput): Promise<Node> {
  const response = await client.post<Node>('/nodes', data);
  return response.data;
}

export async function deleteNode(id: string): Promise<void> {
  await client.delete(`/nodes/${id}`);
}

export async function checkNodeHealth(id: string): Promise<Node> {
  const response = await client.post<Node>(`/nodes/${id}/check`);
  return response.data;
}

export async function restartNode(id: string): Promise<void> {
  await client.post(`/nodes/${id}/restart`);
}

export async function rotateNodeKey(id: string): Promise<void> {
  await client.post(`/nodes/${id}/rotate-key`);
}

export async function rollbackNode(
  id: string,
  revision: string,
  reason?: string,
): Promise<void> {
  await client.post(`/nodes/${id}/rollback`, { revision, reason });
}

export async function getNodeDeployments(
  id: string,
): Promise<NodeDeployment[]> {
  const response = await client.get<NodeDeployment[]>(`/nodes/${id}/deployments`);
  return response.data;
}
