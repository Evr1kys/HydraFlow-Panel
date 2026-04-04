import { client } from './client';
import type { Device } from '../types';

export async function getDevices(): Promise<Device[]> {
  const response = await client.get<Device[]>('/devices');
  return response.data;
}

export async function removeDevice(id: string): Promise<void> {
  await client.delete(`/devices/${id}`);
}
