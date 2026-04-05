import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { NO_ENVELOPE_KEY } from './decorators/no-envelope.decorator';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(NO_ENVELOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Only handle HTTP contexts; bail early for everything else.
    if (ctx.getType() !== 'http') {
      return next.handle();
    }

    const req = ctx.switchToHttp().getRequest<{ url?: string }>();
    const url = req?.url ?? '';

    // Only wrap /api/* responses; skip binary/stream outputs.
    if (skip || !url.startsWith('/api/')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) =>
        data !== undefined && data !== null ? { response: data } : data,
      ),
    );
  }
}
