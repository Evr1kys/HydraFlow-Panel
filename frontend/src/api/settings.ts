import { api } from './client';

export interface PanelSettings {
  id: string; serverIp: string | null; realityPort: number; realitySni: string;
  realityPublicKey: string | null; realityPrivateKey: string | null; realityShortId: string | null;
  wsPort: number; wsPath: string | null; ssPort: number; ssPassword: string | null;
}

export async function getSettings(): Promise<PanelSettings> { return (await api.get<PanelSettings>('/settings')).data; }
export async function updateSettings(data: Partial<PanelSettings>) { return (await api.put<PanelSettings>('/settings', data)).data; }
