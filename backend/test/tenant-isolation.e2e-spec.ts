import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { TENANT_POOL_DATASOURCE } from '~/tenancy/tenancy.constants';

/**
 * Runs against a real Postgres (the `<DB_NAME>_e2e` database, see
 * `e2e-env.ts`) with the full AppModule, so it covers tenant resolution,
 * JWT org binding, repository scoping and row-level security together.
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let tenantPool: DataSource;
  let jwt: JwtService;

  const runId = randomUUID().slice(0, 8);
  let orgA: Organization;
  let orgB: Organization;
  let deptA: string;
  let deptB: string;

  const tokenFor = (org: Organization) =>
    jwt.sign({
      sub: randomUUID(),
      email: `admin-${org.slug}@e2e.test`,
      orgId: org.id,
      isAdmin: true,
    });

  /** A request as a school admin of `org`, against `org` unless overridden. */
  const as = (org: Organization, tenant: Organization = org) => {
    const http = request(app.getHttpServer());
    const auth = (req: request.Test) =>
      req
        .set('x-tenant-id', tenant.slug)
        .set('Authorization', `Bearer ${tokenFor(org)}`);
    return {
      get: (url: string) => auth(http.get(url)),
      post: (url: string, body: object) => auth(http.post(url).send(body)),
      patch: (url: string, body: object) => auth(http.patch(url).send(body)),
      delete: (url: string) => auth(http.delete(url)),
    };
  };

  /** Runs `work` on a tenant-pool connection with `app.org_id` set (or not). */
  const onTenantConnection = async <R>(
    orgId: string | null,
    work: (runner: QueryRunner) => Promise<R>,
  ): Promise<R> => {
    const runner = tenantPool.createQueryRunner();
    await runner.connect();
    try {
      if (orgId) {
        await runner.query(`SELECT set_config('app.org_id', $1, false)`, [
          orgId,
        ]);
      }
      return await work(runner);
    } finally {
      await runner.query('RESET app.org_id');
      await runner.release();
    }
  };

  const createDepartment = async (org: Organization, name: string) => {
    const res = await as(org).post('/api/departments', { name }).expect(201);
    return (res.body as { data: { id: string } }).data.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rootDs = app.get<DataSource>(getDataSourceToken());
    tenantPool = app.get<DataSource>(TENANT_POOL_DATASOURCE);
    jwt = new JwtService({ secret: process.env.JWT_SECRET });

    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save(
      ['a', 'b'].map((x) =>
        orgs.create({
          name: `E2E School ${x.toUpperCase()} ${runId}`,
          slug: `e2e-${x}-${runId}`,
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

  describe('through the API', () => {
    it("lists only the requesting school's rows", async () => {
      const res = await as(orgB).get('/api/departments').expect(200);
      const ids = (res.body as { data: { id: string }[] }).data.map(
        (d) => d.id,
      );

      expect(ids).toContain(deptB);
      expect(ids).not.toContain(deptA);
      expect((res.body as { meta: { total: number } }).meta.total).toBe(1);
    });

    it("returns 404 when reading, updating or deleting another school's row", async () => {
      await as(orgB).get(`/api/departments/${deptA}`).expect(404);
      await as(orgB)
        .patch(`/api/departments/${deptA}`, { name: 'Hijacked' })
        .expect(404);
      await as(orgB).delete(`/api/departments/${deptA}`).expect(404);

      const res = await as(orgA).get(`/api/departments/${deptA}`).expect(200);
      expect((res.body as { data: { name: string } }).data.name).toBe(
        'Science',
      );
    });

    it('rejects a token issued for another school', async () => {
      await as(orgA, orgB).get('/api/departments').expect(401);
    });

    it('rejects an orgId smuggled into the request body', async () => {
      await as(orgB)
        .post('/api/departments', { name: 'Smuggled', orgId: orgA.id })
        .expect(400);
    });
  });

  describe('in the database (row-level security)', () => {
    it('connects the tenant pool as a role that cannot bypass RLS', async () => {
      const [role] = await onTenantConnection(
        null,
        (runner) =>
          runner.query(
            `SELECT current_user AS name, rolbypassrls, rolsuper
             FROM pg_roles WHERE rolname = current_user`,
          ) as Promise<
            { name: string; rolbypassrls: boolean; rolsuper: boolean }[]
          >,
      );

      expect(role.name).toBe(process.env.DB_APP_USERNAME);
      expect(role.rolbypassrls).toBe(false);
      expect(role.rolsuper).toBe(false);
    });

    it('only grants the app role the tables tenant requests use', async () => {
      const [privileges] = await onTenantConnection(
        null,
        (runner) =>
          runner.query(
            `SELECT has_table_privilege('public.departments', 'DELETE') AS departments,
                    has_table_privilege('public.users', 'UPDATE') AS users,
                    has_table_privilege('public.organizations', 'SELECT') AS organizations,
                    has_table_privilege('public.migrations', 'SELECT') AS migrations`,
          ) as Promise<Record<string, boolean>[]>,
      );

      expect(privileges).toEqual({
        departments: true,
        users: true,
        organizations: false,
        migrations: false,
      });
    });

    it('shows no rows when app.org_id is not set', async () => {
      const rows = await onTenantConnection(
        null,
        (runner) =>
          runner.query('SELECT id FROM departments WHERE id = ANY($1)', [
            [deptA, deptB],
          ]) as Promise<{ id: string }[]>,
      );
      expect(rows).toHaveLength(0);
    });

    it("hides another school's rows even from raw SQL", async () => {
      const rows = await onTenantConnection(
        orgB.id,
        (runner) =>
          runner.query('SELECT id FROM departments WHERE id = ANY($1)', [
            [deptA, deptB],
          ]) as Promise<{ id: string }[]>,
      );
      expect(rows.map((r) => r.id)).toEqual([deptB]);
    });

    it("cannot update or delete another school's rows", async () => {
      await onTenantConnection(orgB.id, async (runner) => {
        const updated = await runner.query(
          `UPDATE departments SET name = 'Hijacked' WHERE id = $1`,
          [deptA],
          true,
        );
        const deleted = await runner.query(
          'DELETE FROM departments WHERE id = $1',
          [deptA],
          true,
        );
        expect(updated.affected).toBe(0);
        expect(deleted.affected).toBe(0);
      });

      const [row] = await rootDs.query<{ name: string }[]>(
        'SELECT name FROM departments WHERE id = $1',
        [deptA],
      );
      expect(row.name).toBe('Science');
    });

    it('rejects inserting a row for another school', async () => {
      await expect(
        onTenantConnection(orgB.id, (runner) =>
          runner.query(
            `INSERT INTO departments (org_id, name) VALUES ($1, 'Planted')`,
            [orgA.id],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  describe('data integrity', () => {
    it('keeps exactly one current academic year under concurrent requests', async () => {
      const responses = await Promise.all(
        ['2041', '2042', '2043'].map((name) =>
          as(orgA).post('/api/academic-years', { name, isCurrent: true }),
        ),
      );

      // Losers of the race get 409 from the unique index, never a 500.
      for (const res of responses) expect([201, 409]).toContain(res.status);
      const [{ count }] = await rootDs.query<{ count: string }[]>(
        `SELECT count(*) FROM academic_years
         WHERE org_id = $1 AND is_current AND deleted_at IS NULL`,
        [orgA.id],
      );
      expect(Number(count)).toBe(1);
    });

    it("soft-deletes and lets a deleted record's name be reused", async () => {
      const first = await as(orgA)
        .post('/api/academic-years', { name: '2050' })
        .expect(201);
      const firstId = (first.body as { data: { id: string } }).data.id;

      await as(orgA).delete(`/api/academic-years/${firstId}`).expect(200);
      await as(orgA).get(`/api/academic-years/${firstId}`).expect(404);
      await as(orgA).post('/api/academic-years', { name: '2050' }).expect(201);

      const [row] = await rootDs.query<{ deleted_at: Date | null }[]>(
        'SELECT deleted_at FROM academic_years WHERE id = $1',
        [firstId],
      );
      expect(row.deleted_at).not.toBeNull();
    });
  });

  describe('connection handling', () => {
    it('returns connections to the pool when a guard rejects the request', async () => {
      const poolSize = Number(process.env.DB_TENANT_POOL_SIZE);
      const http = request(app.getHttpServer());

      // More unauthenticated requests than the pool has connections. Before
      // the fix each one leaked a connection and the pool ran dry.
      const responses = await Promise.all(
        Array.from({ length: poolSize * 3 }, () =>
          http.get('/api/departments').set('x-tenant-id', orgA.slug),
        ),
      );
      expect(responses.every((r) => r.status === 401)).toBe(true);

      // Connections are released on the response's `close` event.
      await new Promise((resolve) => setTimeout(resolve, 100));
      const pool = (
        tenantPool.driver as unknown as {
          master: { totalCount: number; idleCount: number };
        }
      ).master;
      expect(pool.totalCount - pool.idleCount).toBe(0);

      await as(orgA).get('/api/departments').expect(200);
    });
  });
});
