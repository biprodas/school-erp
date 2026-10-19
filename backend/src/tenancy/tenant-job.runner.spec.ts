import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TENANT_DATASOURCE } from './tenancy.constants';
import { TenantJobRunner } from './tenant-job.runner';
import type { RequestWithOrg } from './tenant.middleware';

type FakeProxy = { orgId: string; release: jest.Mock };

@Injectable({ scope: Scope.REQUEST })
class TenantService {
  constructor(
    @Inject(TENANT_DATASOURCE) readonly ds: FakeProxy,
    @Inject(REQUEST) readonly req: RequestWithOrg,
  ) {}
}

describe('TenantJobRunner', () => {
  let runner: TenantJobRunner;
  let proxies: FakeProxy[];

  beforeEach(async () => {
    proxies = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantJobRunner,
        TenantService,
        {
          // Same shape as TenancyModule: request-scoped, reads req.orgId.
          provide: TENANT_DATASOURCE,
          scope: Scope.REQUEST,
          inject: [REQUEST],
          useFactory: (req: RequestWithOrg) => {
            const proxy = { orgId: req.orgId!, release: jest.fn() };
            proxies.push(proxy);
            return proxy;
          },
        },
      ],
    }).compile();
    runner = moduleRef.get(TenantJobRunner);
  });

  it('resolves tenant providers scoped to the given org', async () => {
    const service = await runner.run('org-a', (resolve) =>
      resolve(TenantService),
    );

    expect(service.ds.orgId).toBe('org-a');
    expect(service.req.orgId).toBe('org-a');
  });

  it('shares one connection per run and releases it afterwards', async () => {
    await runner.run('org-a', async (resolve) => {
      const a = await resolve(TenantService);
      const b = await resolve(TenantService);
      expect(a.ds).toBe(b.ds);
      expect(a.ds.release).not.toHaveBeenCalled();
    });

    expect(proxies).toHaveLength(1);
    expect(proxies[0].release).toHaveBeenCalledTimes(1);
  });

  it('releases the connection when the work throws', async () => {
    await expect(
      runner.run('org-a', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    expect(proxies[0].release).toHaveBeenCalledTimes(1);
  });

  it('never shares a connection between concurrent runs for different orgs', async () => {
    const [a, b] = await Promise.all([
      runner.run('org-a', (resolve) => resolve(TenantService)),
      runner.run('org-b', (resolve) => resolve(TenantService)),
    ]);

    expect(a.ds.orgId).toBe('org-a');
    expect(b.ds.orgId).toBe('org-b');
    expect(a.ds).not.toBe(b.ds);
  });

  it('exposes the actor as req.user', async () => {
    const service = await runner.run(
      'org-a',
      (resolve) => resolve(TenantService),
      { userId: 'user-1', isAdmin: false },
    );

    expect(service.req.user).toMatchObject({
      userId: 'user-1',
      isAdmin: false,
      orgId: 'org-a',
    });
  });
});
