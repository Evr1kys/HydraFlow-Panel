import axios from 'axios';
import { notifications } from '@mantine/notifications';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hydraflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Allow callers to opt-out of the global notification (e.g. background polling)
// by setting `config.meta.silent = true` on the axios request.
type ClientRequestMeta = { silent?: boolean };

function isSilentConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false;
  const meta = (config as { meta?: ClientRequestMeta }).meta;
  return Boolean(meta?.silent);
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; message?: string }
      | string
      | undefined;
    if (typeof data === 'string' && data) return data;
    if (data && typeof data === 'object') {
      if (data.error) return data.error;
      if (data.message) return data.message;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) {
        localStorage.removeItem('hydraflow_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      // Global error notification for unexpected failures (5xx / network).
      // Skip when the caller marked the request silent, or when it's a
      // client-side validation failure (4xx) that the caller will handle.
      const silent = isSilentConfig(error.config);
      if (!silent && (status === undefined || status >= 500)) {
        const message = extractErrorMessage(error);
        notifications.show({
          title: 'Request failed',
          message,
          color: 'red',
        });
      }
    }
    return Promise.reject(error);
  },
);

export { client };
