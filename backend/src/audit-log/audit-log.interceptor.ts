import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuditLogService } from './audit-log.service';

const SENSITIVE_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'totpSecret',
  'credentials',
  'smtpPass',
  'privateKey',
  'pvk',
];

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => s.toLowerCase() === k.toLowerCase())) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = sanitize(v);
      }
    }
    return result;
  }
  return value;
}

interface RequestWithUser {
  method: string;
  originalUrl?: string;
  url: string;
  user?: { id?: string; email?: string; role?: string };
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  params?: Record<string, string>;
}

function deriveAction(method: string, resource: string, params?: Record<string, string>, url?: string): string {
  const m = method.toUpperCase();
  // Determine sub-action from URL trailing segment when present
  // e.g. POST /users/:id/toggle -> user.toggle
  const urlPath = (url ?? '').split('?')[0] ?? '';
  const segments = urlPath.split('/').filter(Boolean);
  // Remove 'api' prefix if present
  if (segments[0] === 'api') segments.shift();
  const base = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  // If last segment is not an id and not equal to resource, treat as action
  const last = segments[segments.length - 1] ?? '';
  const id = params?.['id'];
  const isIdSegment = !!id && last === id;
  const tail = !isIdSegment && segments.length > 1 && last !== resource ? last : '';

  if (m === 'POST') {
    if (tail) return `${base}.${tail}`;
    return `${base}.create`;
  }
  if (m === 'PUT' || m === 'PATCH') {
    if (tail) return `${base}.${tail}`;
    return `${base}.update`;
  }
  if (m === 'DELETE') {
    if (tail) return `${base}.${tail}`;
    return `${base}.delete`;
  }
  return `${base}.${m.toLowerCase()}`;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithUser>();
    const res = http.getResponse<{ statusCode: number }>();

    const method = (req.method ?? 'GET').toUpperCase();

    // Only log non-GET requests
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next.handle();
    }

    const url = req.originalUrl ?? req.url ?? '';
    const pathOnly = url.split('?')[0] ?? '';
    const segments = pathOnly.split('/').filter(Boolean);
    if (segments[0] === 'api') segments.shift();
    const resource = segments[0] ?? 'unknown';
    const action = deriveAction(method, resource, req.params, url);
    const resourceId = req.params?.['id'] ?? null;

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;
    const adminId = req.user?.id ?? null;
    const payload = sanitize(req.body) as Record<string, unknown> | unknown[] | null;

    // Skip auth login itself (no JWT yet) - still log but with no adminId
    const skipBodyResources = new Set(['auth']);
    const safePayload =
      skipBodyResources.has(resource) && action.includes('login')
        ? null
        : payload;

    return next.handle().pipe(
      tap(() => {
        const status = res.statusCode ?? 200;
        void this.auditLogService.log({
          adminId,
          action,
          resource,
          resourceId,
          payload: (safePayload ?? null) as never,
          ip,
          userAgent,
          success: status < 400,
        });
      }),
      catchError((err: unknown) => {
        const errorMsg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
        void this.auditLogService.log({
          adminId,
          action,
          resource,
          resourceId,
          payload: (safePayload ?? null) as never,
          ip,
          userAgent,
          success: false,
          errorMsg,
        });
        return throwError(() => err);
      }),
    );
  }
}
