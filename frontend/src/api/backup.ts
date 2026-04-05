import { client } from './client';

export interface BackupJob {
  id: string;
  type: string;
  status: string;
  filePath: string | null;
  fileSize: string | null;
  errorMsg: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export async function listBackups(): Promise<BackupJob[]> {
  const response = await client.get<BackupJob[]>('/backup/list');
  return response.data;
}

export async function createBackup(): Promise<BackupJob> {
  const response = await client.post<BackupJob>('/backup/create');
  return response.data;
}

export async function deleteBackup(id: string): Promise<{ message: string }> {
  const response = await client.delete<{ message: string }>(`/backup/${id}`);
  return response.data;
}

export async function restoreBackup(
  id: string,
): Promise<{ message: string }> {
  const response = await client.post<{ message: string }>(
    `/backup/${id}/restore`,
  );
  return response.data;
}

export function downloadBackupUrl(id: string): string {
  return `/api/backup/${id}/download`;
}
