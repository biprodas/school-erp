import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { App } from 'supertest/types';
import { DataSource, In } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { DepartmentRepository } from '~/modules/departments/department.repository';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import {
  TENANT_DATASOURCE,
  TENANT_POOL_DATASOURCE,
} from '~/tenancy/tenancy.constants';
import type { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';

/**
 * TenantJobRunner (plan 4.2) against a real Postgres: background work for
 * one school runs on a tenant-pool connection under row-level security, so
 * it sees that school's rows only, and the connection goes back clean.
 */
describe('TenantJobRunner (e2e) [tenant-isolation]', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let tenantPool: DataSource;
  let runner: TenantJobRunner;

  const runId = randomUUID().slice(0, 8);
  let orgA: Organization;
  let orgB: Organization;
  let deptA: string;
  let deptB: string;

  const createDepartment = (org: Organization, name: string) =>
    runner.run(org.id, async (resolve) => {
      const departments = await resolve(DepartmentRepository);
      return (await departments.saveNew({ name })).id;
    });

  /** What a job for `org` sees: through a tenant repository and raw SQL. */
  const visibleTo = (org: Organization) =>
    runner.run(org.id, async (resolve) => {
      const departments = await resolve(DepartmentRepository);
      const ds = await resolve<TenantDataSourceProxy>(TENANT_DATASOURCE);
      const viaRepository = (
        await departments.find({ where: { id: In([deptA, deptB]) } })
      ).map((d) => d.id);
      // The manager is not org-scoped: only RLS stands between it and
      // other schools' rows.
      const viaSql = (
        await ds
          .getManager()
          .query<{ id: string }[]>(
            'SELECT id FROM departments WHERE id = ANY($1)',
            [[deptA, deptB]],
          )
      ).map((r) => r.id);
      const [{ setting }] = await ds
        .getManager()
        .query<{ setting: string }[]>(
          `SELECT current_setting('app.org_id', true) AS setting`,
        );
      return { viaRepository, viaSql, setting, dsOrgId: ds.orgId };
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rootDs = app.get<DataSource>(getDataSourceToken());
    tenantPool = app.get<DataSource>(TENANT_POOL_DATASOURCE);
    runner = app.get(TenantJobRunner);

    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save(
      ['a', 'b'].map((x) =>
        orgs.create({
          name: `E2E Job Runner ${x.toUpperCase()} ${runId}`,
          slug: `e2e-runner-${x}-${runId}`,
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );

    deptA = await createDepartment(orgA, 'Science');
    deptB = await createDepartment(orgB, 'Arts');
  });

  afterAll(async () => {
    // Deleting an organization cascades to all of its rows.
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) {
        await rootDs.getRepository(Organization).delete(ids);
      }
    }
    await app?.close();
  });

  it("writes rows for the job's own school", async () => {
    const rows = await rootDs.query<{ id: string; org_id: string }[]>(
      'SELECT id, org_id FROM departments WHERE id = ANY($1) ORDER BY name',
      [[deptA, deptB]],
    );
    expect(rows).toEqual([
      { id: deptB, org_id: orgB.id },
      { id: deptA, org_id: orgA.id },
    ]);
  });

  it("sees only org A's rows in a job for org A", async () => {
    const seen = await visibleTo(orgA);
    expect(seen).toEqual({
      viaRepository: [deptA],
      viaSql: [deptA],
      setting: orgA.id,
      dsOrgId: orgA.id,
    });
  });

  it('keeps concurrent jobs for different schools apart', async () => {
    const [a, b] = await Promise.all([visibleTo(orgA), visibleTo(orgB)]);
    expect(a.viaSql).toEqual([deptA]);
    expect(b.viaSql).toEqual([deptB]);
    expect(b.viaRepository).toEqual([deptB]);
  });

  it("can't change or plant another school's rows", async () => {
    await runner.run(orgB.id, async (resolve) => {
      const ds = await resolve<TenantDataSourceProxy>(TENANT_DATASOURCE);
      await ds
        .getManager()
        .query(`UPDATE departments SET name = 'Hijacked' WHERE id = $1`, [
          deptA,
        ]);
      await ds
        .getManager()
        .query('DELETE FROM departments WHERE id = $1', [deptA]);
    });

    await expect(
      runner.run(orgB.id, async (resolve) => {
        const ds = await resolve<TenantDataSourceProxy>(TENANT_DATASOURCE);
        await ds
          .getManager()
          .query(
            `INSERT INTO departments (org_id, name) VALUES ($1, 'Planted')`,
            [orgA.id],
          );
      }),
    ).rejects.toThrow(/row-level security/);

    const [row] = await rootDs.query<{ name: string }[]>(
      'SELECT name FROM departments WHERE id = $1',
      [deptA],
    );
    expect(row.name).toBe('Science');
  });

  it('returns its connection to the pool with the school setting cleared', async () => {
    await expect(
      runner.run(orgA.id, () => Promise.reject(new Error('job failed'))),
    ).rejects.toThrow('job failed');

    const pool = (
      tenantPool.driver as unknown as {
        master: { totalCount: number; idleCount: number };
      }
    ).master;
    expect(pool.totalCount - pool.idleCount).toBe(0);

    // A pooled connection taken without the runner sees no school at all.
    const raw = tenantPool.createQueryRunner();
    await raw.connect();
    try {
      const [{ setting }] = (await raw.query(
        `SELECT NULLIF(current_setting('app.org_id', true), '') AS setting`,
      )) as { setting: string | null }[];
      expect(setting).toBeNull();
      const rows = (await raw.query(
        'SELECT id FROM departments WHERE id = ANY($1)',
        [[deptA, deptB]],
      )) as { id: string }[];
      expect(rows).toHaveLength(0);
    } finally {
      await raw.release();
    }
  });
});
