import { client } from './client';

interface XrayStatus {
  running: boolean;
  version: string | null;
  uptime: string | null;
}

export async function getXrayStatus(): Promise<XrayStatus> {
  const response = await client.get<XrayStatus>('/xray/status');
  return response.data;
}

export async function restartXray(): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>('/xray/restart');
  return response.data;
}
