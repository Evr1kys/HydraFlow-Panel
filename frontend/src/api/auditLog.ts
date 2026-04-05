import { client } from './client';

export interface AuditLogEntry {
  id: string;
  adminId: string | null;
  admin: { id: string; email: string } | null;
  action: string;
  resource: string;
  resourceId: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  errorMsg: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogFilters {
  adminId?: string;
  resource?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

function toParams(filters: AuditLogFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.adminId) params['adminId'] = filters.adminId;
  if (filters.resource) params['resource'] = filters.resource;
  if (filters.action) params['action'] = filters.action;
  if (filters.from) params['from'] = filters.from;
  if (filters.to) params['to'] = filters.to;
  if (filters.limit !== undefined) params['limit'] = String(filters.limit);
  if (filters.offset !== undefined) params['offset'] = String(filters.offset);
  return params;
}

export async function listAuditLogs(
  filters: AuditLogFilters = {},
): Promise<AuditLogListResponse> {
  const response = await client.get<AuditLogListResponse>('/audit-logs', {
    params: toParams(filters),
  });
  return response.data;
}

export async function exportAuditLogs(
  filters: AuditLogFilters = {},
): Promise<Blob> {
  const response = await client.get('/audit-logs/export', {
    params: toParams(filters),
    responseType: 'blob',
  });
  return response.data as Blob;
}
