import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';

const PROXY_KEY = '__tenantProxy';

/**
 * Releases the tenant QueryRunner back to the shared pool after the
 * response is sent (or on error). Attached globally in AppModule.
 */
@Injectable()
export class TenantCleanupInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantCleanupInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      finalize(async () => {
        const req = context.switchToHttp().getRequest();
        const proxy: TenantDataSourceProxy | undefined = req[PROXY_KEY];
        if (proxy && !proxy.isReleased) {
          try {
            await proxy.release();
          } catch (err) {
            this.logger.warn(
              `Failed to release tenant QueryRunner: ${(err as Error).message}`,
            );
          }
        }
      }),
    );
  }
}

/** Attach the proxy to the request so the interceptor can clean it up. */
export function attachProxyToRequest(req: any, proxy: TenantDataSourceProxy) {
  req[PROXY_KEY] = proxy;
}
