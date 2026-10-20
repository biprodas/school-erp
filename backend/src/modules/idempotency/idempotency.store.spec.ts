import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import type { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { IdempotencyStore } from './idempotency.store';

describe('IdempotencyStore', () => {
  const query = jest.fn();
  const store = new IdempotencyStore({
    ...fakeTenantDataSource('org-1'),
    getManager: () => ({ query }),
  } as unknown as TenantDataSourceProxy);

  beforeEach(() => {
    query.mockReset().mockResolvedValue([{ id: 'k1' }]);
  });

  it('keeps keys per user, so one user never replays another user’s request', async () => {
    await store.claim('client-key-1', 'hash', 'user-a');
    await store.claim('client-key-1', 'hash', 'user-b');
    await store.claim('client-key-1', 'hash', null);

    const keys = query.mock.calls.map(([, params]: [string, unknown[]]) => [
      params[0],
      params[1],
    ]);
    expect(keys).toEqual([
      ['org-1', 'user-a:client-key-1'],
      ['org-1', 'user-b:client-key-1'],
      ['org-1', '-:client-key-1'],
    ]);
  });
});
