import { client } from './client';

export type MetadataMap = Record<string, string>;

export async function getUserMetadata(userId: string): Promise<MetadataMap> {
  const response = await client.get<MetadataMap>(`/users/${userId}/metadata`);
  return response.data;
}

export async function setUserMetadata(
  userId: string,
  key: string,
  value: string,
): Promise<{ key: string; value: string }> {
  const response = await client.put<{ key: string; value: string }>(
    `/users/${userId}/metadata/${encodeURIComponent(key)}`,
    { value },
  );
  return response.data;
}

export async function deleteUserMetadata(
  userId: string,
  key: string,
): Promise<void> {
  await client.delete(`/users/${userId}/metadata/${encodeURIComponent(key)}`);
}

export async function getNodeMetadata(nodeId: string): Promise<MetadataMap> {
  const response = await client.get<MetadataMap>(`/nodes/${nodeId}/metadata`);
  return response.data;
}

export async function setNodeMetadata(
  nodeId: string,
  key: string,
  value: string,
): Promise<{ key: string; value: string }> {
  const response = await client.put<{ key: string; value: string }>(
    `/nodes/${nodeId}/metadata/${encodeURIComponent(key)}`,
    { value },
  );
  return response.data;
}

export async function deleteNodeMetadata(
  nodeId: string,
  key: string,
): Promise<void> {
  await client.delete(`/nodes/${nodeId}/metadata/${encodeURIComponent(key)}`);
}
