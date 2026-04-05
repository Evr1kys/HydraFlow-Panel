import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestUser {
  id?: string;
  email?: string;
  role?: string;
  enabled?: boolean;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles decorator => allow any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (user.enabled === false) {
      throw new ForbiddenException('Account disabled');
    }

    const role = user.role ?? 'admin';

    // superadmin always has access
    if (role === 'superadmin') {
      return true;
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `Role '${role}' is not allowed to access this resource`,
      );
    }

    return true;
  }
}
