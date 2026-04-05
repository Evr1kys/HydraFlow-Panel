import { client } from './client';
import type { DashboardStats, DashboardRecap } from '../types';

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await client.get<DashboardStats>('/dashboard/stats');
  return response.data;
}

export async function getDashboardRecap(): Promise<DashboardRecap> {
  const response = await client.get<DashboardRecap>('/dashboard/recap');
  return response.data;
}
