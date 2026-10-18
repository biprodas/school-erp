import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';

/**
 * Adds the request's `orgId` and `userId` to every log line written while
 * the handler runs. Runs as an interceptor, after the tenant middleware and
 * the auth guards have filled them in.
 */
@Injectable()
export class LogContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<Request>();
      const fields = {
        orgId: (req as RequestWithOrg).orgId,
        userId: req.user?.userId,
      };
      if (fields.orgId || fields.userId) {
        try {
          this.logger.assign(fields);
        } catch {
          // Outside a pino request context (e.g. unit tests): nothing to do.
        }
      }
    }
    return next.handle();
  }
}
