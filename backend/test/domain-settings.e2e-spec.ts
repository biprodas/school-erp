import { randomUUID } from 'crypto';
import { ACTIVE_SESSIONS, TEST_SESSION_ID } from './support/sessions';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationDomain } from '~/modules/organizations/entities/organization-domain.entity';
import { DomainStatus } from '~/modules/organizations/enums/domain-status.enum';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import {
  DNS_RESOLVER,
  DnsResolver,
} from '~/modules/organizations/services/domain-dns.service';
import { DomainCheckScheduler } from '~/modules/organizations/services/domain-check.scheduler';
import { DNS_FAILURE_GRACE_MS } from '~/modules/organizations/services/domain-lifecycle';

interface DomainBody {
  id: string;
  hostname: string;
  status: DomainStatus;
  isPrimary: boolean;
  verificationToken: string;
  dnsRecords: { type: string; name: string; value: string }[];
  check?: { cname: boolean; txt: boolean };
}

/**
 * Settings → Domain through the full stack (tenant JWT, RLS, real Postgres),
 * with DNS answered by an in-memory zone instead of the network.
 */
describe('Domain settings (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let jwt: JwtService;

  const runId = randomUUID().slice(0, 8);
  const host = (label: string) => `${label}-${runId}.e2e-school.test`;
  let orgA: Organization;
  let orgB: Organization;

  // In-memory DNS zone.
  const cnames = new Map<string, string[]>();
  const txts = new Map<string, string[][]>();
  const notFound = () =>
    Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
  const fakeResolver: DnsResolver = {
    resolveCname: (h) => {
      const records = cnames.get(h);
      return records ? Promise.resolve(records) : Promise.reject(notFound());
    },
    resolveTxt: (h) => {
      const records = txts.get(h);
      return records ? Promise.resolve(records) : Promise.reject(notFound());
    },
  };
  /** Publish the records the API asked the school to create. */
  const publish = (domain: DomainBody) => {
    for (const r of domain.dnsRecords) {
      if (r.type === 'CNAME') cnames.set(r.name, [r.value]);
      else txts.set(r.name, [[r.value]]);
    }
  };

  const as = (org: Organization) => {
    const token = jwt.sign({
      sub: randomUUID(),
      orgId: org.id,
      isAdmin: true,
      sid: TEST_SESSION_ID,
    });
    const http = request(app.getHttpServer());
    const auth = (req: request.Test) =>
      req.set('x-tenant-id', org.slug).set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(http.get(url)),
      post: (url: string, body: object = {}) => auth(http.post(url).send(body)),
      delete: (url: string) => auth(http.delete(url)),
    };
  };
  const data = <T>(res: request.Response) => (res.body as { data: T }).data;
  const resolve = (hostname: string) =>
    request(app.getHttpServer())
      .get('/api/public/organizations/resolve')
      .query({ host: hostname });
  const tlsCheck = (hostname: string) =>
    request(app.getHttpServer())
      .get('/api/public/organizations/tls-check')
      .query({ domain: hostname });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DNS_RESOLVER)
      .useValue(fakeResolver)
      .overrideProvider(ACTIVE_SESSIONS.provide)
      .useValue(ACTIVE_SESSIONS.useValue)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rootDs = app.get<DataSource>(getDataSourceToken());
    jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save(
      ['a', 'b'].map((x) =>
        orgs.create({
          name: `E2E Domain Settings ${x.toUpperCase()} ${runId}`,
          slug: `e2e-dset-${x}-${runId}`,
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );
  });

  afterAll(async () => {
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) await rootDs.getRepository(Organization).delete(ids);
    }
    await app?.close();
  });

  it('adds, verifies, makes primary and removes a domain', async () => {
    const hostname = host('erp');
    const added = data<DomainBody>(
      await as(orgA)
        .post('/api/domains', { hostname: hostname.toUpperCase() })
        .expect(201),
    );
    expect(added).toMatchObject({ hostname, status: DomainStatus.PENDING });
    expect(added.dnsRecords).toContainEqual({
      type: 'TXT',
      name: `_school-verify.${hostname}`,
      value: added.verificationToken,
    });

    // Not routable, and no certificate, until verified.
    await resolve(hostname).expect(404);
    await tlsCheck(hostname).expect(404);

    // Records missing: stays pending, says which check failed.
    const failed = data<DomainBody>(
      await as(orgA).post(`/api/domains/${added.id}/verify`).expect(200),
    );
    expect(failed.status).toBe(DomainStatus.PENDING);
    expect(failed.check).toEqual({ cname: false, txt: false });
    await as(orgA).post(`/api/domains/${added.id}/primary`).expect(400);

    publish(added);
    const verified = data<DomainBody>(
      await as(orgA).post(`/api/domains/${added.id}/verify`).expect(200),
    );
    expect(verified.status).toBe(DomainStatus.VERIFIED);
    expect(
      data<{ slug: string }>(await resolve(hostname).expect(200)).slug,
    ).toBe(orgA.slug);
    await tlsCheck(hostname).expect(200);

    await as(orgA).post(`/api/domains/${added.id}/primary`).expect(200);

    // A second verified domain takes over as primary.
    const second = data<DomainBody>(
      await as(orgA)
        .post('/api/domains', { hostname: host('app') })
        .expect(201),
    );
    publish(second);
    await as(orgA).post(`/api/domains/${second.id}/verify`).expect(200);
    await as(orgA).post(`/api/domains/${second.id}/primary`).expect(200);
    const list = data<DomainBody[]>(
      await as(orgA).get('/api/domains').expect(200),
    );
    expect(list.map((d) => [d.hostname, d.isPrimary])).toEqual([
      [second.hostname, true],
      [hostname, false],
    ]);

    await as(orgA).delete(`/api/domains/${added.id}`).expect(200);
    await resolve(hostname).expect(404);
  });

  it("keeps schools apart: no shared hostnames, no access to another school's domains", async () => {
    const hostname = host('shared');
    const mine = data<DomainBody>(
      await as(orgA).post('/api/domains', { hostname }).expect(201),
    );

    const res = await as(orgB).post('/api/domains', { hostname }).expect(409);
    expect((res.body as { message: string }).message).toBe(
      'This domain is already in use by another school',
    );

    await as(orgB).post(`/api/domains/${mine.id}/verify`).expect(404);
    await as(orgB).delete(`/api/domains/${mine.id}`).expect(404);
    const listB = data<DomainBody[]>(
      await as(orgB).get('/api/domains').expect(200),
    );
    expect(listB.map((d) => d.id)).not.toContain(mine.id);
  });

  it('rejects hosts under the platform domain and invalid hostnames', async () => {
    const root = process.env.ROOT_DOMAIN || 'lvh.me';
    await as(orgA)
      .post('/api/domains', { hostname: `x.${root}` })
      .expect(400);
    await as(orgA).post('/api/domains', { hostname: 'not a host' }).expect(400);
  });

  it('the periodic check verifies pending domains and retires dead ones', async () => {
    const domains = rootDs.getRepository(OrganizationDomain);
    const now = new Date();
    const pending = await domains.save(
      domains.create({
        orgId: orgB.id,
        hostname: host('job-pending'),
        verificationToken: 'p'.repeat(64),
      }),
    );
    cnames.set(pending.hostname, [
      `schools.${process.env.ROOT_DOMAIN || 'lvh.me'}`,
    ]);
    txts.set(`_school-verify.${pending.hostname}`, [['p'.repeat(64)]]);
    const dead = await domains.save(
      domains.create({
        orgId: orgB.id,
        hostname: host('job-dead'),
        status: DomainStatus.ACTIVE,
        verificationToken: 'd'.repeat(64),
        verifiedAt: new Date('2026-01-01'),
        dnsFailingSince: new Date(now.getTime() - DNS_FAILURE_GRACE_MS - 1000),
      }),
    );

    await app.get(DomainCheckScheduler).runOnce(now);

    expect((await domains.findOneByOrFail({ id: pending.id })).status).toBe(
      DomainStatus.VERIFIED,
    );
    expect((await domains.findOneByOrFail({ id: dead.id })).status).toBe(
      DomainStatus.INACTIVE,
    );
    await resolve(dead.hostname).expect(404);
  });
});
