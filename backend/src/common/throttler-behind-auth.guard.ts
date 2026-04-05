import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Custom throttler guard that skips rate-limiting for authenticated admin
 * users on regular API endpoints, but ALWAYS enforces limits on auth-related
 * endpoints (login, passkeys, oauth, 2fa, refresh, register, etc.) to protect
 * against credential stuffing / brute-force even when a valid JWT is already
 * attached to the request.
 */
@Injectable()
export class ThrottlerBehindAuthGuard extends ThrottlerGuard {
  /** URL path fragments that must always be rate-limited. */
  private static readonly AUTH_PATHS = [
    '/api/auth',
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/passkeys',
    '/auth/oauth',
    '/auth/2fa',
  ];

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: { id?: string } }
    >();

    const path = (req.path || req.url || '').toLowerCase();
    const isAuthEndpoint = ThrottlerBehindAuthGuard.AUTH_PATHS.some((p) =>
      path.includes(p),
    );

    // Never skip on auth endpoints — always throttle.
    if (isAuthEndpoint) {
      return false;
    }

    // For non-auth endpoints, skip throttling for authenticated admins.
    // (JwtAuthGuard attaches req.user when a valid Bearer token is present.)
    if (req.user?.id) {
      return true;
    }

    return false;
  }

  /**
   * Use the X-Forwarded-For header (if present) or the socket remote address
   * as the tracker key. This keeps rate-limiting per-IP even behind reverse
   * proxies.
   */
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded =
      (req.headers?.['x-forwarded-for'] as string | undefined) ?? '';
    const ip =
      forwarded.split(',')[0]?.trim() ||
      (req.ip as string | undefined) ||
      (req.socket?.remoteAddress as string | undefined) ||
      'unknown';
    return ip;
  }
}
