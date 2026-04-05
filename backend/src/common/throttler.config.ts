import { ThrottlerModule } from '@nestjs/throttler';

/**
 * Centralized rate-limit configuration.
 *
 * Named throttlers:
 *   - "default" : 100 requests / 60 seconds (applied everywhere unless overridden)
 *   - "auth"    : 5 requests / 60 seconds (brute-force protection on auth endpoints)
 *   - "api"     : 100 requests / 60 seconds (explicit alias for general API endpoints)
 *
 * Usage in controllers:
 *   @Throttle({ auth: { limit: 5, ttl: 60000 } })
 *   @Post('login')
 *   login() { ... }
 */
export const ThrottlerConfig = ThrottlerModule.forRoot([
  {
    name: 'default',
    ttl: 60_000,
    limit: 100,
  },
  {
    name: 'auth',
    ttl: 60_000,
    limit: 5,
  },
  {
    name: 'api',
    ttl: 60_000,
    limit: 100,
  },
]);
