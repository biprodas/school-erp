import { randomUUID } from 'crypto';
import { ACTIVE_SESSIONS, TEST_SESSION_ID } from './support/sessions';
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

/** `expect.objectContaining` typed, for nesting inside matcher objects. */
const like = (shape: object): unknown =>
  expect.objectContaining(shape) as unknown;

interface AuditRow {
  id: string;
  action: string;
  actorUserId: string | null;
  actorType: string;
  entityType: string | null;
  entityId: string | null;
  after: Record<string, unknown> | null;
  requestId: string | null;
}

/**
 * Audit log (plan 4.5) against a real Postgres: rows are written for auth
 * and role changes, each school sees only its own, and the app role can't
 * change or delete them.
 */
describe('Audit log (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let tenantPool: DataSource;
  let jwt: JwtService;

  const runId = randomUUID().slice(0, 8);
  const adminId = randomUUID();
  let orgA: Organization;
  let orgB: Organization;

  const as = (org: Organization) => {
    const token = jwt.sign({
      sub: adminId,
      orgId: org.id,
      isAdmin: true,
      sid: TEST_SESSION_ID,
    });
    const http = request(app.getHttpServer());
    const auth = (req: request.Test) =>
      req.set('x-tenant-id', org.slug).set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(http.get(url)),
      post: (url: string, body: object) => auth(http.post(url).send(body)),
    };
  };

  const auditOf = async (org: Organization, query = '') => {
    const res = await as(org).get(`/api/audit-logs${query}`).expect(200);
    return (res.body as { data: AuditRow[] }).data;
  };

  const onTenantConnection = async <R>(
    orgId: string,
    work: (runner: QueryRunner) => Promise<R>,
  ): Promise<R> => {
    const runner = tenantPool.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(`SELECT set_config('app.org_id', $1, false)`, [orgId]);
      return await work(runner);
    } finally {
      await runner.query('RESET app.org_id');
      await runner.release();
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ACTIVE_SESSIONS.provide)
      .useValue(ACTIVE_SESSIONS.useValue)
      .compile();
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
          name: `E2E Audit ${x.toUpperCase()} ${runId}`,
          slug: `e2e-audit-${x}-${runId}`,
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );
  });

  afterAll(async () => {
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) {
        await rootDs.getRepository(Organization).delete(ids);
      }
    }
    await app?.close();
  });

  it('records a role change with its actor and request id', async () => {
    const requestId = randomUUID();
    const res = await as(orgA)
      .post('/api/roles', {
        name: `auditor_${runId}`,
        permissions: ['students:read'],
      })
      .set('x-request-id', requestId)
      .expect(201);
    const roleId = (res.body as { data: { id: string } }).data.id;

    const rows = await auditOf(orgA, '?action=role.created');
    expect(rows[0]).toMatchObject({
      action: 'role.created',
      actorUserId: adminId,
      actorType: 'user',
      entityType: 'role',
      entityId: roleId,
      requestId,
      after: like({ permissions: ['students:read'] }),
    });
  });

  it("never shows one school's rows to another [tenant-isolation]", async () => {
    // Both schools hold a role event, so an empty list can't pass by itself.
    const res = await as(orgB)
      .post('/api/roles', {
        name: `auditor_b_${runId}`,
        permissions: ['students:read'],
      })
      .expect(201);
    const roleIdB = (res.body as { data: { id: string } }).data.id;
    const [rowA] = await auditOf(orgA, '?action=role.created');
    expect(rowA).toBeDefined();

    const rowsB = await auditOf(orgB, '?action=role.');
    const ids = rowsB.map((row) => row.id);
    expect(ids).not.toContain(rowA.id);
    expect(rowsB).toEqual([
      like({ action: 'role.created', entityType: 'role', entityId: roleIdB }),
    ]);
  });

  it('records a failed sign-in for an unknown account anonymously', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-tenant-id', orgA.slug)
      .send({ identifier: `nobody-${runId}@example.com`, password: 'wrong-1' })
      .expect(401);

    const [row] = await auditOf(orgA, '?action=auth.login_failed');
    expect(row).toMatchObject({
      actorUserId: null,
      actorType: 'user',
      after: like({
        identifier: `nobody-${runId}@example.com`,
        reason: 'unknown_account',
      }),
    });
    expect(JSON.stringify(row)).not.toContain('wrong-1');
  });

  it('records platform sign-in failures on the platform log', async () => {
    const requestId = randomUUID();
    await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .set('x-request-id', requestId)
      .send({ identifier: `nobody-${runId}@example.com`, password: 'wrong-1' })
      .expect(401);

    const rows = await rootDs.query<
      { action: string; org_id: string | null }[]
    >('SELECT action, org_id FROM platform_audit_logs WHERE request_id = $1', [
      requestId,
    ]);
    expect(rows).toEqual([{ action: 'auth.login_failed', org_id: null }]);
  });

  describe('immutability', () => {
    it('grants the app role SELECT and INSERT only', async () => {
      const [privileges] = await onTenantConnection(
        orgA.id,
        (runner) =>
          runner.query(
            `SELECT has_table_privilege('public.audit_logs', 'SELECT') AS select,
                    has_table_privilege('public.audit_logs', 'INSERT') AS insert,
                    has_table_privilege('public.audit_logs', 'UPDATE') AS update,
                    has_table_privilege('public.audit_logs', 'DELETE') AS delete,
                    has_table_privilege('public.platform_audit_logs', 'SELECT') AS platform`,
          ) as Promise<Record<string, boolean>[]>,
      );
      expect(privileges).toEqual({
        select: true,
        insert: true,
        update: false,
        delete: false,
        platform: false,
      });
    });

    it('refuses UPDATE and DELETE from the tenant connection', async () => {
      await onTenantConnection(orgA.id, async (runner) => {
        await expect(
          runner.query(`UPDATE audit_logs SET action = 'tampered'`),
        ).rejects.toThrow(/permission denied/);
        await expect(runner.query('DELETE FROM audit_logs')).rejects.toThrow(
          /permission denied/,
        );
      });
      const [{ count }] = await rootDs.query<{ count: string }[]>(
        `SELECT count(*) FROM audit_logs WHERE org_id = $1 AND action = 'tampered'`,
        [orgA.id],
      );
      expect(count).toBe('0');
    });
  });
});
