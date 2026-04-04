import { client } from './client';
import type { Node } from '../types';

export async function getNodes(): Promise<Node[]> {
  const response = await client.get<Node[]>('/nodes');
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
