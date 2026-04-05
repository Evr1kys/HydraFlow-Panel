import { client } from './client';
import type { Node } from '../types';
import type { PaginationParams, PaginatedResult } from '../hooks/usePaginated';

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

export async function createNode(data: {
  name: string;
  address: string;
  port: number;
  apiKey?: string;
}): Promise<Node> {
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
