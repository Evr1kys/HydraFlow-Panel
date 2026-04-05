import { client } from './client';
import type { TrafficHistoryData } from '../types';

export async function getTrafficHistory(period: string): Promise<TrafficHistoryData> {
  const response = await client.get<TrafficHistoryData>('/traffic/history', {
    params: { period },
  });
  return response.data;
}

export interface TrafficHistoryPointRaw {
  date: string;
  upload: string;
  download: string;
}

export interface TrafficHistoryPointNumeric {
  date: string;
  upload: number;
  download: number;
}

export async function getTrafficHistoryDaily(
  days: number,
): Promise<TrafficHistoryPointNumeric[]> {
  const response = await client.get<TrafficHistoryPointRaw[]>(
    '/traffic/history',
    {
      params: { period: 'daily', days },
    },
  );
  return response.data.map((p) => ({
    date: p.date,
    upload: Number(p.upload),
    download: Number(p.download),
  }));
}
