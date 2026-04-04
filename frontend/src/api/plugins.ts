import { client } from './client';
import type { NodePlugin } from '../types';

export async function getAllPlugins(): Promise<NodePlugin[]> {
  const response = await client.get<NodePlugin[]>('/plugins');
  return response.data;
}

export async function getNodePlugins(nodeId: string): Promise<NodePlugin[]> {
  const response = await client.get<NodePlugin[]>(
    `/nodes/${nodeId}/plugins`,
  );
  return response.data;
}

export async function createNodePlugin(
  nodeId: string,
  data: { type: string; config?: string; enabled?: boolean },
): Promise<NodePlugin> {
  const response = await client.post<NodePlugin>(
    `/nodes/${nodeId}/plugins`,
    { ...data, nodeId },
  );
  return response.data;
}

export async function updatePlugin(
  id: string,
  data: { config?: string; enabled?: boolean },
): Promise<NodePlugin> {
  const response = await client.put<NodePlugin>(`/plugins/${id}`, data);
  return response.data;
}

export async function deletePlugin(id: string): Promise<void> {
  await client.delete(`/plugins/${id}`);
}

export async function executePlugin(
  nodeId: string,
  pluginId: string,
): Promise<{ message: string; executedAt: string }> {
  const response = await client.post<{ message: string; executedAt: string }>(
    `/nodes/${nodeId}/plugins/${pluginId}/execute`,
  );
  return response.data;
}
