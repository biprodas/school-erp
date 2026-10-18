import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';

const PROXY_KEY = '__tenantProxy';
const HANDLER_STARTED_KEY = '__tenantHandlerStarted';

type RequestWithTenantProxy = Request & {
  [PROXY_KEY]?: TenantDataSourceProxy;
  [HANDLER_STARTED_KEY]?: boolean;
};

const logger = new Logger('TenantCleanup');

async function releaseProxy(req: RequestWithTenantProxy): Promise<void> {
  const proxy = req[PROXY_KEY];
  if (!proxy || proxy.isReleased) return;
  try {
    await proxy.release();
  } catch (err) {
    logger.warn(
      `Failed to release tenant QueryRunner: ${(err as Error).message}`,
    );
  }
}

/**
 * Releases the tenant QueryRunner back to the shared pool once the handler
 * finishes (or errors). Attached globally in AppModule.
 *
 * The QueryRunner is acquired while Nest builds the request-scoped provider
 * tree, which happens before guards run. When a guard rejects the request
 * (401/403/429), interceptors never run, so `attachProxyToRequest` also
 * registers a fallback on the response's `close` event.
 */
@Injectable()
export class TenantCleanupInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<RequestWithTenantProxy>();
    req[HANDLER_STARTED_KEY] = true;
    return next.handle().pipe(
      finalize(() => {
        void releaseProxy(req);
      }),
    );
  }
}

/**
 * Attach the proxy to the request so it is always released: by the
 * interceptor when the handler ran, otherwise when the response closes.
 * The fallback skips requests whose handler started, so it never releases
 * a connection a still-running handler is using (e.g. on client abort).
 */
export function attachProxyToRequest(
  req: Request,
  proxy: TenantDataSourceProxy,
): void {
  const tenantReq = req as RequestWithTenantProxy;
  tenantReq[PROXY_KEY] = proxy;
  tenantReq.res?.once('close', () => {
    if (!tenantReq[HANDLER_STARTED_KEY]) void releaseProxy(tenantReq);
  });
}
