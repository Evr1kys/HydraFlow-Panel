import { client } from './client';
import type { TrafficHistoryData } from '../types';

export async function getTrafficHistory(period: string): Promise<TrafficHistoryData> {
  const response = await client.get<TrafficHistoryData>('/traffic/history', {
    params: { period },
  });
  return response.data;
}
