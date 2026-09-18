import type { ConfigService } from '@nestjs/config';

const KNOWN_WEAK_SECRETS = new Set([
  'change_this_secret',
  'change-me',
  'changeme',
  'secret',
  'hydraflow',
]);

export function requireJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET')?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  if (KNOWN_WEAK_SECRETS.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET uses a known insecure default');
  }
  return secret;
}
