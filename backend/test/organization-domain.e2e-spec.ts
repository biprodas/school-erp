import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
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

/**
 * Custom domains resolve to their school only once verified, and a hostname
 * belongs to at most one school.
 */
describe('Organization domains (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;

  const runId = randomUUID().slice(0, 8);
  const activeHost = `erp-${runId}.e2e-school.test`;
  const pendingHost = `pending-${runId}.e2e-school.test`;
  let org: Organization;

  const resolve = (host: string) =>
    request(app.getHttpServer())
      .get('/api/public/organizations/resolve')
      .query({ host });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rootDs = app.get<DataSource>(getDataSourceToken());
    const orgs = rootDs.getRepository(Organization);
    org = await orgs.save(
      orgs.create({
        name: `E2E Domains ${runId}`,
        slug: `e2e-domains-${runId}`,
        status: OrganizationStatus.ACTIVE,
      }),
    );

    const domains = rootDs.getRepository(OrganizationDomain);
    await domains.save([
      domains.create({
        orgId: org.id,
        hostname: activeHost,
        isPrimary: true,
        status: DomainStatus.ACTIVE,
        verificationToken: 'a'.repeat(64),
        verifiedAt: new Date(),
      }),
      domains.create({
        orgId: org.id,
        hostname: pendingHost,
        status: DomainStatus.PENDING,
        verificationToken: 'b'.repeat(64),
      }),
    ]);
  });

  afterAll(async () => {
    if (rootDs?.isInitialized && org?.id) {
      await rootDs.getRepository(Organization).delete(org.id);
    }
    await app?.close();
  });

  it('resolves an active domain to its school, case- and port-insensitively', async () => {
    const res = await resolve(`${activeHost.toUpperCase()}:443`).expect(200);
    expect((res.body as { data: { slug: string } }).data.slug).toBe(org.slug);
  });

  it('does not resolve a domain whose ownership is not verified', async () => {
    await resolve(pendingHost).expect(404);
  });

  it('rejects the same hostname for a second school', async () => {
    const other = await rootDs.getRepository(Organization).save(
      rootDs.getRepository(Organization).create({
        name: `E2E Domains Other ${runId}`,
        slug: `e2e-domains-other-${runId}`,
      }),
    );
    try {
      await expect(
        rootDs.getRepository(OrganizationDomain).insert({
          orgId: other.id,
          hostname: activeHost,
          verificationToken: 'c'.repeat(64),
        }),
      ).rejects.toThrow(/uq_organization_domains_hostname/);
    } finally {
      await rootDs.getRepository(Organization).delete(other.id);
    }
  });

  it('allows only one primary domain per school', async () => {
    await expect(
      rootDs
        .getRepository(OrganizationDomain)
        .update({ orgId: org.id, hostname: pendingHost }, { isPrimary: true }),
    ).rejects.toThrow(/uq_organization_domains_org_primary/);
  });

  it('deletes the domains with their school', async () => {
    const orgs = rootDs.getRepository(Organization);
    const doomed = await orgs.save(
      orgs.create({
        name: `E2E Domains Doomed ${runId}`,
        slug: `e2e-domains-doomed-${runId}`,
      }),
    );
    const domains = rootDs.getRepository(OrganizationDomain);
    await domains.insert({
      orgId: doomed.id,
      hostname: `doomed-${runId}.e2e-school.test`,
      verificationToken: 'd'.repeat(64),
    });

    await orgs.delete(doomed.id);

    expect(await domains.countBy({ orgId: doomed.id })).toBe(0);
  });
});
