import { client } from './client';

export interface MigrationProgress {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export async function migrateFrom3xui(file: File): Promise<MigrationProgress> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await client.post<MigrationProgress>('/migrate/3xui', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function migrateFromMarzban(file: File): Promise<MigrationProgress> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await client.post<MigrationProgress>('/migrate/marzban', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
