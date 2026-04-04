import { api } from './client';

export interface DashboardStats {
  totalUsers: number; activeUsers: number;
  totalTrafficUp: string; totalTrafficDown: string;
  xray: { running: boolean; version: string | null; uptime: number | null };
}

export async function getStats(): Promise<DashboardStats> { return (await api.get<DashboardStats>('/dashboard/stats')).data; }
