import { client } from './client';
import type { ProtocolHealth } from '../types';

export async function getHealth(): Promise<ProtocolHealth[]> {
  const response = await client.get<ProtocolHealth[]>('/health');
  return response.data;
}
