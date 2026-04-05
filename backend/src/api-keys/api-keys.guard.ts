import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  user?: unknown;
}

@Injectable()
export class ApiKeysGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestLike>();
    const authHeader = req.headers['authorization'];
    const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token.startsWith('hf_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const key = await this.apiKeysService.findByPlaintext(token);
    if (!key || key.revoked) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('API key expired');
    }
    if (!key.admin || key.admin.enabled === false) {
      throw new UnauthorizedException('API key owner disabled');
    }

    void this.apiKeysService.touchLastUsed(key.id);

    (req as unknown as { user: unknown }).user = {
      id: key.admin.id,
      email: key.admin.email,
      role: key.admin.role,
      enabled: key.admin.enabled,
      apiKeyId: key.id,
      scopes: key.scopes,
    };
    return true;
  }
}
