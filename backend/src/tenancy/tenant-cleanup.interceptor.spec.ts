import { EventEmitter } from 'events';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { of, throwError, lastValueFrom } from 'rxjs';
import {
  TenantCleanupInterceptor,
  attachProxyToRequest,
} from './tenant-cleanup.interceptor';
import type { TenantDataSourceProxy } from './tenant-datasource.proxy';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function makeProxy() {
  const proxy = {
    isReleased: false,
    release: jest.fn(() => {
      proxy.isReleased = true;
      return Promise.resolve();
    }),
  };
  return proxy;
}

function makeRequest() {
  const res = new EventEmitter();
  const req = { res } as unknown as Request;
  return { req, res };
}

function contextFor(req: Request): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('TenantCleanupInterceptor', () => {
  const interceptor = new TenantCleanupInterceptor();

  it('releases the connection after the handler completes', async () => {
    const { req } = makeRequest();
    const proxy = makeProxy();
    attachProxyToRequest(req, proxy as unknown as TenantDataSourceProxy);

    const handler: CallHandler = { handle: () => of('ok') };
    await lastValueFrom(interceptor.intercept(contextFor(req), handler));
    await flush();

    expect(proxy.release).toHaveBeenCalledTimes(1);
  });

  it('releases the connection when the handler throws', async () => {
    const { req } = makeRequest();
    const proxy = makeProxy();
    attachProxyToRequest(req, proxy as unknown as TenantDataSourceProxy);

    const handler: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };
    await expect(
      lastValueFrom(interceptor.intercept(contextFor(req), handler)),
    ).rejects.toThrow('boom');
    await flush();

    expect(proxy.release).toHaveBeenCalledTimes(1);
  });

  it('releases the connection on response close when a guard rejected the request', async () => {
    const { req, res } = makeRequest();
    const proxy = makeProxy();
    attachProxyToRequest(req, proxy as unknown as TenantDataSourceProxy);

    // Guard threw: the interceptor never ran, the error response is sent.
    res.emit('close');
    await flush();

    expect(proxy.release).toHaveBeenCalledTimes(1);
  });

  it('does not release on response close while the handler is still running', async () => {
    const { req, res } = makeRequest();
    const proxy = makeProxy();
    attachProxyToRequest(req, proxy as unknown as TenantDataSourceProxy);

    const handler: CallHandler = { handle: () => of('ok') };
    const result$ = interceptor.intercept(contextFor(req), handler);

    // Client aborted before the handler finished.
    res.emit('close');
    await flush();
    expect(proxy.release).not.toHaveBeenCalled();

    await lastValueFrom(result$);
    await flush();
    expect(proxy.release).toHaveBeenCalledTimes(1);
  });
});
