import { Injectable, Type } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import type { AuthUser } from '~/common/auth/auth-user';
import { TENANT_DATASOURCE } from './tenancy.constants';
import type { TenantDataSourceProxy } from './tenant-datasource.proxy';
import type { RequestWithOrg } from './tenant.middleware';

/** Resolves request-scoped providers inside a `TenantJobRunner.run` call. */
export type TenantResolver = <T>(
  token: Type<T> | string | symbol,
) => Promise<T>;

/**
 * Runs background work (queue jobs, schedulers) as one school, exactly like
 * a request: it registers a synthetic request carrying `orgId` (and the
 * actor) for a fresh DI context, so `TENANT_DATASOURCE` takes a tenant-pool
 * connection with `app.org_id` set and every tenant repository resolved
 * through `resolve` is org-scoped and under RLS. The connection is released
 * when `work` settles. Never read tenant data through the root connection.
 */
@Injectable()
export class TenantJobRunner {
  constructor(private readonly moduleRef: ModuleRef) {}

  async run<R>(
    orgId: string,
    work: (resolve: TenantResolver) => Promise<R>,
    actor?: Pick<AuthUser, 'userId' | 'isAdmin'>,
  ): Promise<R> {
    const contextId = ContextIdFactory.create();
    const request = {
      orgId,
      headers: {},
      user: actor ? { ...actor, email: '', orgId } : undefined,
    } as unknown as RequestWithOrg;
    this.moduleRef.registerRequestByContextId(request, contextId);

    const resolve: TenantResolver = (token) =>
      this.moduleRef.resolve(token, contextId, { strict: false });

    const ds = await resolve<TenantDataSourceProxy>(TENANT_DATASOURCE);
    try {
      return await work(resolve);
    } finally {
      await ds.release();
    }
  }
}
