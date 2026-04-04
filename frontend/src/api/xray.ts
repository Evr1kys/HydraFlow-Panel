import { api } from './client';

export async function getXrayStatus() { return (await api.get('/xray/status')).data; }
export async function restartXray() { return (await api.post('/xray/restart')).data; }
export async function getXrayConfig() { return (await api.get('/xray/config')).data; }
export async function updateXrayConfig(config: Record<string, unknown>) { return (await api.post('/xray/config', config)).data; }
