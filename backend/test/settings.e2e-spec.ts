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
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';

interface SettingsBody {
  data: {
    organization: { name: string; eiin: string | null };
    locale: { language: string; weekendDays: string[]; timeZone: string };
    fees: { billingDay: number; graceDays: number };
  };
}

/** Settings (plan 4.6) against a real Postgres, per school and audited. */
describe('Settings (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let jwt: JwtService;

  const runId = randomUUID().slice(0, 8);
  let orgA: Organization;
  let orgB: Organization;

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
      patch: (url: string, body: object) => auth(http.patch(url).send(body)),
    };
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
    jwt = new JwtService({ secret: process.env.JWT_SECRET });

    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save([
      orgs.create({
        name: `E2E Settings A ${runId}`,
        slug: `e2e-settings-a-${runId}`,
        status: OrganizationStatus.ACTIVE,
      }),
      // A school in its trial works like an active one.
      orgs.create({
        name: `E2E Settings B ${runId}`,
        slug: `e2e-settings-b-${runId}`,
        status: OrganizationStatus.TRIAL,
      }),
    ]);
  });

  afterAll(async () => {
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) await rootDs.getRepository(Organization).delete(ids);
    }
    await app?.close();
  });

  it('serves the defaults before anything is saved', async () => {
    const res = await as(orgA).get('/api/settings').expect(200);
    const { data } = res.body as SettingsBody;
    expect(data.organization.name).toBe(`E2E Settings A ${runId}`);
    expect(data.locale.timeZone).toBe('Asia/Dhaka');
    expect(data.fees.billingDay).toBe(1);
  });

  it('saves a section, merges later patches and keeps schools apart [tenant-isolation]', async () => {
    await as(orgA)
      .patch('/api/settings/locale', {
        language: 'bn',
        weekendDays: ['friday', 'saturday'],
      })
      .expect(200);
    const res = await as(orgA)
      .patch('/api/settings/locale', { numerals: 'bn' })
      .expect(200);
    expect((res.body as { data: Record<string, unknown> }).data).toMatchObject({
      language: 'bn',
      numerals: 'bn',
      weekendDays: ['friday', 'saturday'],
    });

    const other = await as(orgB).get('/api/settings').expect(200);
    expect((other.body as SettingsBody).data.locale.language).toBe('en');
  });

  it('stores only what the school changed', async () => {
    const [row] = await rootDs.query<{ locale: unknown; fees: unknown }[]>(
      'SELECT locale, fees FROM org_settings WHERE org_id = $1',
      [orgA.id],
    );
    expect(row.locale).toEqual({
      language: 'bn',
      numerals: 'bn',
      weekendDays: ['friday', 'saturday'],
    });
    expect(row.fees).toBeNull();
  });

  it('serializes concurrent changes without losing either', async () => {
    // These schools were inserted directly, without the row that
    // organization creation (or the back-fill migration) adds, so the first
    // writes also exercise the conflict-free create.
    await Promise.all([
      as(orgB).patch('/api/settings/fees', { billingDay: 5 }).expect(200),
      as(orgB).patch('/api/settings/fees', { graceDays: 3 }).expect(200),
    ]);
    const res = await as(orgB).get('/api/settings').expect(200);
    expect((res.body as SettingsBody).data.fees).toMatchObject({
      billingDay: 5,
      graceDays: 3,
    });
  });

  it('rejects invalid and unknown values', async () => {
    await as(orgA).patch('/api/settings/fees', { billingDay: 31 }).expect(400);
    await as(orgA)
      .patch('/api/settings/locale', { timeZone: 'Mars/Olympus' })
      .expect(400);
    await as(orgA)
      .patch('/api/settings/results', { verifyStep: true, extra: 1 })
      .expect(400);
    // A nested object can't be replaced by an array.
    await as(orgA).patch('/api/settings/profile', { address: [] }).expect(400);
    await as(orgA)
      .patch('/api/settings/notifications', { events: { absent: [{}] } })
      .expect(400);
  });

  it("updates the school's own organization fields", async () => {
    await as(orgA)
      .patch('/api/settings/organization', { eiin: '108224' })
      .expect(200);
    const [row] = await rootDs.query<{ eiin: string }[]>(
      'SELECT eiin FROM organizations WHERE id = $1',
      [orgA.id],
    );
    expect(row.eiin).toBe('108224');
  });

  it('audits every change with before and after', async () => {
    const res = await as(orgA)
      .get('/api/audit-logs?action=settings.updated&entityId=locale')
      .expect(200);
    const rows = (res.body as { data: { after: { numerals?: string } }[] })
      .data;
    expect(rows).toHaveLength(2);
    expect(rows[0].after.numerals).toBe('bn');
  });

  it('serves display settings to any signed-in member', async () => {
    const res = await as(orgA).get('/api/settings/display').expect(200);
    expect(res.body).toMatchObject({
      data: { locale: { language: 'bn' }, logoUrl: null },
    });
  });
});
