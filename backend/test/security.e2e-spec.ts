import { randomInt, randomUUID } from 'crypto';
import { Like } from 'typeorm';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';
import { MemoryStorage, withMemoryStorage } from './support/storage';

jest.setTimeout(120_000);

interface Row {
  id: string;
  [key: string]: unknown;
}
interface JobView {
  id: string;
  status: string;
  downloadUrl?: string | null;
  result?: { tables?: number } | null;
}

type Key = 'a' | 'b';

/** A one-pixel PNG, a type every document purpose accepts. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const METRICS_TOKEN = 'metrics-token-for-the-e2e-run-0123456789';

/**
 * M8 pilot hardening (backend plan 12, PRD 8.2/11.5): school records and
 * files can't be reached across schools or by guessing ids, platform and
 * school tokens stay in their realm, uploads are checked for type and size,
 * responses carry secure headers, the full data export is for school
 * admins only, and the metrics endpoint needs its token.
 */
describe('Security hardening [tenant-isolation] (e2e)', () => {
  let e: E2eApp;
  const storage = new MemoryStorage();
  const runId = randomUUID().slice(0, 8);
  const phone = `01${randomInt(3, 10)}${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

  const schools: Record<
    Key,
    { org: Organization; token: string; ownerId: string }
  > = {} as never;
  const ids: Record<string, string> = {};
  let teacherToken: string;

  const as = (token: string, org: Organization) => {
    const req = (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
      e
        .http()
        [method](url)
        .set('x-tenant-id', org.slug)
        .set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => req('get', url),
      post: (url: string, body: object = {}) => req('post', url).send(body),
      patch: (url: string, body: object) => req('patch', url).send(body),
      delete: (url: string) => req('delete', url),
      upload: (url: string) => req('post', url),
    };
  };
  const admin = (k: Key = 'a') => as(schools[k].token, schools[k].org);
  /** School A's token sent to school B's host. */
  const aAtB = () => as(schools.a.token, schools.b.org);
  const drain = () => e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
  const created = async (res: Promise<{ body: unknown }>) =>
    data<Row>(await res).id;

  async function makeSchool(k: Key) {
    const users = e.rootDs.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `m8-${k}-${runId}@e2e.test`,
        name: `Owner ${k}`,
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    const org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E M8 ${k} ${runId}`,
        slug: `e2e-m8-${k}-${runId}`,
        type: OrganizationType.SCHOOL,
        ownerUserId: owner.id,
      }),
    );
    const { sessionId } = await e.app
      .get(SessionService)
      .start(owner.id, org.id);
    schools[k] = {
      org,
      ownerId: owner.id,
      token: e.jwt.sign({
        sub: owner.id,
        orgId: org.id,
        isAdmin: true,
        sid: sessionId,
      }),
    };
    ids[`class-${k}`] = await created(
      admin(k).post('/api/classes', { name: 'Class 6', level: 6 }).expect(201),
    );
    ids[`student-${k}`] = await created(
      admin(k)
        .post('/api/students', {
          classId: ids[`class-${k}`],
          firstName: `Student${k}`,
          lastName: 'Secure',
        })
        .expect(201),
    );
    ids[`doc-${k}`] = await created(
      admin(k)
        .upload(`/api/students/${ids[`student-${k}`]}/documents`)
        .field('documentType', 'birth_certificate')
        .attach('file', PNG, 'birth.png')
        .expect(201),
    );
  }

  beforeAll(async () => {
    e = await bootApp(withMemoryStorage(storage), {
      METRICS_TOKEN,
    });
    await makeSchool('a');
    await makeSchool('b');

    const roles = data<{ id: string; name: string }[]>(
      await admin().get('/api/roles?limit=100').expect(200),
    );
    const employee = await created(
      admin()
        .post('/api/employees', {
          firstName: 'Rafiq',
          lastName: 'Teacher',
          phone,
        })
        .expect(201),
    );
    const invite = data<{ userId: string }>(
      await admin()
        .post(`/api/employees/${employee}/invite`, {
          roleIds: [roles.find((r) => r.name === 'teacher')!.id],
        })
        .expect(201),
    );
    await e.rootDs
      .getRepository(User)
      .update({ id: invite.userId }, { mustChangePassword: false });
    const { sessionId } = await e.app
      .get(SessionService)
      .start(invite.userId, schools.a.org.id);
    teacherToken = e.jwt.sign({
      sub: invite.userId,
      orgId: schools.a.org.id,
      isAdmin: false,
      sid: sessionId,
    });
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-m8-%-${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`m8-%-${runId}@e2e.test`) });
      await e.rootDs.query(`DELETE FROM users WHERE phone LIKE $1`, [
        `+880${phone.slice(1)}`,
      ]);
    }
    await e?.close();
  });

  it("doesn't reach another school's students, documents or files by id", async () => {
    const theirs = ids['student-b'];
    const theirDoc = ids['doc-b'];
    await admin().get(`/api/students/${theirs}`).expect(404);
    await admin()
      .patch(`/api/students/${theirs}`, { firstName: 'Hacked' })
      .expect(404);
    await admin().get(`/api/students/${theirs}/documents`).expect(404);
    await admin()
      .get(`/api/students/${theirs}/documents/${theirDoc}/download`)
      .expect(404);
    // Our student with their document id: still not found.
    await admin()
      .get(`/api/students/${ids['student-a']}/documents/${theirDoc}/download`)
      .expect(404);
    await admin()
      .upload(`/api/students/${theirs}/documents`)
      .field('documentType', 'birth_certificate')
      .attach('file', PNG, 'x.png')
      .expect(404);

    const list = data<Row[]>(
      await admin().get('/api/students?limit=100').expect(200),
    );
    expect(list.map((s) => s.id)).toEqual([ids['student-a']]);

    const theirsNow = data<Row>(
      await admin('b').get(`/api/students/${theirs}`).expect(200),
    );
    expect(theirsNow.firstName).toBe('Studentb');
  });

  it("doesn't let one school's token act at another school's host", async () => {
    const res = await aAtB().get('/api/students').expect(401);
    expect(res.body).toMatchObject({ success: false });
    await aAtB().get(`/api/students/${ids['student-a']}`).expect(401);
  });

  it("doesn't read another school's jobs", async () => {
    const job = data<Row>(
      await admin('b').post('/api/settings/export').expect(202),
    );
    await drain();
    await admin().get(`/api/jobs/${job.id}`).expect(404);
    const mine = data<JobView>(
      await admin('b').get(`/api/jobs/${job.id}`).expect(200),
    );
    expect(mine.status).toBe('succeeded');
  });

  it('keeps platform and school tokens in their own realm', async () => {
    const platform = await e.platformToken(
      schools.a.ownerId,
      PlatformRole.SUPER_ADMIN,
    );
    await e
      .http()
      .get('/api/students')
      .set('x-tenant-id', schools.a.org.slug)
      .set('Authorization', `Bearer ${platform}`)
      .expect(401);
    await e
      .http()
      .get('/api/organizations')
      .set('Authorization', `Bearer ${schools.a.token}`)
      .expect(401);
    // A forged token (wrong key) is refused too.
    await e
      .http()
      .get('/api/students')
      .set('x-tenant-id', schools.a.org.slug)
      .set('Authorization', `Bearer ${schools.a.token.slice(0, -4)}AAAA`)
      .expect(401);
  });

  it('refuses uploads of the wrong type or over the size limit', async () => {
    const url = `/api/students/${ids['student-a']}/documents`;
    const wrongType = await admin()
      .upload(url)
      .field('documentType', 'birth_certificate')
      .attach('file', Buffer.from('#!/bin/sh\necho hi\n'), 'birth.pdf')
      .expect(400);
    expect(error(wrongType).code).toBe('FILE_TYPE_NOT_ALLOWED');

    await admin()
      .upload(url)
      .field('documentType', 'birth_certificate')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1, 1), 'big.png')
      .expect(413);

    const missing = await admin()
      .upload(url)
      .field('documentType', 'birth_certificate')
      .expect(400);
    expect(error(missing).code).toBe('FILE_REQUIRED');
  });

  it('sends secure headers and keeps API responses out of caches', async () => {
    const res = await admin().get('/api/students').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('exports all school data for school admins only, and emails the link', async () => {
    const refused = await as(teacherToken, schools.a.org)
      .post('/api/settings/export')
      .expect(403);
    expect(error(refused).code).toBe('SCHOOL_ADMIN_ONLY');

    const job = data<Row>(
      await admin().post('/api/settings/export').expect(202),
    );
    await drain();
    const done = data<JobView>(
      await admin().get(`/api/jobs/${job.id}`).expect(200),
    );
    expect(done.status).toBe('succeeded');
    expect(done.downloadUrl).toMatch(/^https:\/\/storage\.test\//);

    const zipKey = decodeURIComponent(
      new URL(done.downloadUrl!).pathname.slice(1),
    );
    const zip = storage.objects.get(zipKey)!;
    expect(zip.contentType).toBe('application/zip');
    const text = zip.body.toString('latin1');
    expect(text.startsWith('PK')).toBe(true);
    for (const name of ['manifest.json', 'students.csv', 'members.csv']) {
      expect(text).toContain(name);
    }

    const owner = `m8-a-${runId}@e2e.test`;
    expect(e.mail.to(owner, 'sendDataExportReady')).toHaveLength(1);

    const [audit] = await e.rootDs.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM audit_logs WHERE org_id = $1 AND action = 'data.exported'`,
      [schools.a.org.id],
    );
    expect(audit.n).toBe(1);
  });

  it('serves metrics only with the metrics token', async () => {
    await e.http().get('/api/metrics').expect(401);
    await e
      .http()
      .get('/api/metrics')
      .set('Authorization', 'Bearer wrong-token-of-another-length')
      .expect(401);
    const res = await e
      .http()
      .get('/api/metrics')
      .set('Authorization', `Bearer ${METRICS_TOKEN}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toContain('school_erp_process_uptime_seconds');
    expect(res.text).toMatch(
      /school_erp_jobs_24h\{type="settings\.export",status="succeeded"\} \d+/,
    );
  });
});
