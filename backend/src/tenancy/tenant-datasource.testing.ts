import type { TenantDataSourceProxy } from './tenant-datasource.proxy';

/**
 * Stand-in for `TENANT_DATASOURCE` in unit tests of services that use
 * `runInTransaction`: runs the work directly, without a database.
 */
export function fakeTenantDataSource(
  orgId = 'org-test',
): TenantDataSourceProxy {
  return {
    orgId,
    runInTransaction: <R>(work: () => Promise<R>) => work(),
  } as unknown as TenantDataSourceProxy;
}
