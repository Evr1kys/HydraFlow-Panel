import { client } from './client';

interface XrayStatus {
  running: boolean;
  version: string | null;
  uptime: string | null;
}

interface ConfigResponse {
  config: string;
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export async function getXrayStatus(): Promise<XrayStatus> {
  const response = await client.get<XrayStatus>('/xray/status');
  return response.data;
}

export async function restartXray(): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>('/xray/restart');
  return response.data;
}

export async function getXrayConfig(): Promise<string> {
  const response = await client.get<ConfigResponse>('/xray/config');
  return response.data.config;
}

export async function saveXrayConfig(config: string): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>('/xray/config', { config });
  return response.data;
}

export async function getDefaultXrayConfig(): Promise<string> {
  const response = await client.get<ConfigResponse>('/xray/config/default');
  return response.data.config;
}

export async function validateXrayConfig(config: string): Promise<ValidationResult> {
  const response = await client.post<ValidationResult>('/xray/validate', { config });
  return response.data;
}
