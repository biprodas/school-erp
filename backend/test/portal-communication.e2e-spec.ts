import { randomInt, randomUUID } from 'crypto';
import { Like } from 'typeorm';
import { localDate } from '~/shared/dates/local-date';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { CommunicationScheduler } from '~/modules/notices/communication.scheduler';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';
import { MemoryStorage, withMemoryStorage } from './support/storage';

jest.setTimeout(240_000);

interface Row {
  id: string;
  [key: string]: unknown;
}
interface Child {
  studentId: string;
  name: string;
}
interface NotificationRow {
  type: string;
  title: string;
  link: string | null;
  data: Record<string, string>;
}

type Key = 'a' | 'b';

/**
 * M7 acceptance (backend plan 11, PRD 6.13/6.14/6.22): a guardian with two
 * children sees only them (and nothing staff-only), notices reach their
 * audience with read receipts, results and payments notify the family,
 * dues hold results back, leave from the portal, children at two schools
 * through a handoff, the communication log, dashboards, the public home
 * page and background report exports.
 */
describe('Portal, notices and notifications (e2e)', () => {
  let e: E2eApp;
  const storage = new MemoryStorage();
  const runId = randomUUID().slice(0, 8);
  const phoneBase = `01${randomInt(3, 10)}${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
  const phone = (i: number) => `${phoneBase}${String(i).padStart(2, '0')}`;
  const today = localDate('Asia/Dhaka');
  const Y = Number(today.slice(0, 4));
  const guardianEmail = `m7-g-${runId}@e2e.test`;

  const schools: Record<Key, { org: Organization; token: string }> =
    {} as never;
  const ids: Record<string, string> = {};
  const students: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  const as = (token: string, org: Organization) => {
    const req = (method: 'get' | 'post' | 'patch' | 'put', url: string) =>
      e
        .http()
        [method](url)
        .set('x-tenant-id', org.slug)
        .set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => req('get', url),
      post: (url: string, body: object = {}) => req('post', url).send(body),
      patch: (url: string, body: object) => req('patch', url).send(body),
      put: (url: string, body: object) => req('put', url).send(body),
    };
  };
  const admin = (k: Key = 'a') => as(schools[k].token, schools[k].org);
  const guardian = () => as(tokens.g, schools.a.org);
  const other = () => as(tokens.h, schools.a.org);
  const drain = () => e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
  const created = async (res: Promise<{ body: unknown }>) =>
    data<Row>(await res).id;
  const dispatch = async () => {
    await e.app
      .get(CommunicationScheduler)
      .runOnce(new Date(), [schools.a.org.id]);
    await drain();
  };
  const notificationsOf = async (who: () => ReturnType<typeof guardian>) =>
    data<NotificationRow[]>(
      await who().get('/api/notifications?limit=100').expect(200),
    );

  async function signIn(userId: string, k: Key, isAdmin = false) {
    await e.rootDs
      .getRepository(User)
      .update(
        { id: userId },
        { status: UserStatus.ACTIVE, mustChangePassword: false },
      );
    const { sessionId } = await e.app
      .get(SessionService)
      .start(userId, schools[k].org.id);
    return e.jwt.sign({
      sub: userId,
      orgId: schools[k].org.id,
      isAdmin,
      sid: sessionId,
    });
  }

  async function makeSchool(k: Key) {
    const users = e.rootDs.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `m7-${k}-${runId}@e2e.test`,
        name: `Owner ${k}`,
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    const org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E M7 ${k} ${runId}`,
        slug: `e2e-m7-${k}-${runId}`,
        type: OrganizationType.SCHOOL,
        ownerUserId: owner.id,
      }),
    );
    const { sessionId } = await e.app
      .get(SessionService)
      .start(owner.id, org.id);
    schools[k] = {
      org,
      token: e.jwt.sign({
        sub: owner.id,
        orgId: org.id,
        isAdmin: true,
        sid: sessionId,
      }),
    };
    ids[`year-${k}`] = await created(
      admin(k)
        .post('/api/academic-years', {
          name: `${Y}`,
          startDate: `${Y}-01-01`,
          endDate: `${Y}-12-31`,
          isCurrent: true,
        })
        .expect(201),
    );
    ids[`class-${k}`] = await created(
      admin(k).post('/api/classes', { name: 'Class 6', level: 6 }).expect(201),
    );
    for (const name of ['A', 'B']) {
      ids[`${k}${name}`] = await created(
        admin(k)
          .post('/api/sections', {
            academicYearId: ids[`year-${k}`],
            classId: ids[`class-${k}`],
            name,
          })
          .expect(201),
      );
    }
  }

  async function enrol(k: Key, key: string, section: string, roll: string) {
    students[key] = await created(
      admin(k)
        .post('/api/students', {
          classId: ids[`class-${k}`],
          firstName: key,
          lastName: 'Child',
        })
        .expect(201),
    );
    await admin(k)
      .post('/api/enrollments', {
        studentId: students[key],
        academicYearId: ids[`year-${k}`],
        classId: ids[`class-${k}`],
        sectionId: ids[`${k}${section}`],
        rollNo: roll,
      })
      .expect(201);
  }

  /** A guardian (made, or found by phone) linked to the students. */
  async function family(
    k: Key,
    keys: string[],
    g: { name: string; phone: string; email?: string },
  ) {
    let guardianId: string | null = null;
    for (const key of keys) {
      const link: { guardianId: string } = data<{ guardianId: string }>(
        await admin(k)
          .post(`/api/students/${students[key]}/guardians`, {
            ...(guardianId ? { guardianId } : { createGuardian: g }),
            relation: 'father',
            isPrimary: true,
          })
          .expect(201),
      );
      guardianId = link.guardianId;
    }
    const [row] = await e.rootDs.query<{ user_id: string }[]>(
      'SELECT user_id FROM guardians WHERE id = $1',
      [guardianId],
    );
    return { guardianId: guardianId!, userId: row.user_id };
  }

  beforeAll(async () => {
    e = await bootApp(withMemoryStorage(storage), { PDF_NO_SANDBOX: 'true' });
    await makeSchool('a');
    await makeSchool('b');
    await enrol('a', 's1', 'A', '1');
    await enrol('a', 's2', 'A', '2');
    await enrol('a', 's3', 'B', '1');
    await enrol('b', 'b1', 'A', '1');
    const g = await family('a', ['s1', 's2'], {
      name: 'Rahim',
      phone: phone(1),
      email: guardianEmail,
    });
    ids.guardianUser = g.userId;
    const h = await family('a', ['s3'], { name: 'Karim', phone: phone(2) });
    // The same guardian at school B: one account, two memberships.
    const gb = await family('b', ['b1'], {
      name: 'Rahim',
      phone: phone(1),
      email: guardianEmail,
    });
    expect(gb.userId).toBe(g.userId);
    tokens.g = await signIn(g.userId, 'a');
    tokens.h = await signIn(h.userId, 'a');
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-m7-%-${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`m7-%-${runId}@e2e.test`) });
      await e.rootDs.query(`DELETE FROM users WHERE phone LIKE $1`, [
        `+880${phoneBase.slice(1)}%`,
      ]);
    }
    await e?.close();
  });

  it('[tenant-isolation] shows a guardian only their two children, and nothing staff-only', async () => {
    const children = data<Child[]>(
      await guardian().get('/api/portal/children').expect(200),
    );
    expect(children.map((c) => c.studentId).sort()).toEqual(
      [students.s1, students.s2].sort(),
    );
    await guardian()
      .get(`/api/portal/children/${students.s1}/dashboard`)
      .expect(200);
    for (const url of [
      `/api/portal/children/${students.s3}/dashboard`,
      `/api/portal/children/${students.s3}/fees`,
      `/api/portal/children/${students.s3}/attendance`,
      `/api/portal/children/${students.b1}/results`,
    ]) {
      await guardian().get(url).expect(404);
    }
    for (const url of [
      '/api/students',
      `/api/students/${students.s1}`,
      '/api/invoices',
      `/api/invoices/statement/${students.s1}`,
      `/api/attendance/sections/${ids.aA}`,
      '/api/result-definitions',
      '/api/communication-log',
      '/api/dashboards/admin',
    ]) {
      await guardian().get(url).expect(403);
    }
  });

  it('delivers notices to their audience, with read receipts and a notification', async () => {
    const sectionNotice = await created(
      admin()
        .post('/api/notices', {
          title: 'Class 6A picnic',
          body: 'The picnic is on Thursday.',
          audience: { type: 'section', ids: [ids.aA] },
        })
        .expect(201),
    );
    await admin()
      .post('/api/notices', {
        title: 'Staff meeting',
        body: 'At 2 pm.',
        audience: { type: 'staff' },
      })
      .expect(201);
    await admin()
      .post('/api/notices', {
        title: 'Admission open',
        body: 'Admissions for next year are open.',
        audience: { type: 'all' },
        isPublic: true,
        pinned: true,
      })
      .expect(201);
    await admin()
      .post('/api/notices', {
        title: 'Later',
        body: 'Not yet.',
        audience: { type: 'all' },
        publishAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);
    const missingIds = await admin()
      .post('/api/notices', {
        title: 'x',
        body: 'y',
        audience: { type: 'section' },
      })
      .expect(400);
    expect(error(missingIds).code).toBe('AUDIENCE_IDS_REQUIRED');

    const titles = async (who: () => ReturnType<typeof guardian>) =>
      data<{ title: string }[]>(
        await who().get('/api/portal/notices').expect(200),
      ).map((n) => n.title);
    expect(await titles(guardian)).toEqual([
      'Admission open',
      'Class 6A picnic',
    ]);
    expect(await titles(other)).toEqual(['Admission open']);
    await other().get(`/api/portal/notices/${sectionNotice}`).expect(404);

    await guardian().post(`/api/notices/${sectionNotice}/read`).expect(200);
    const reads = data<{ audience: number; read: number }>(
      await admin().get(`/api/notices/${sectionNotice}/reads`).expect(200),
    );
    expect(reads).toMatchObject({ audience: 1, read: 1 });

    await drain();
    const mine = await notificationsOf(guardian);
    expect(
      mine.filter((n) => n.type === 'noticePublished').map((n) => n.title),
    ).toEqual(
      expect.arrayContaining([
        'Notice: Class 6A picnic',
        'Notice: Admission open',
      ]),
    );
    expect((await notificationsOf(other)).map((n) => n.title)).not.toContain(
      'Notice: Class 6A picnic',
    );

    const home = data<{ name: string; notices: { title: string }[] }>(
      await e
        .http()
        .get(`/api/public/organizations/${schools.a.org.slug}/home`)
        .expect(200),
    );
    expect(home.notices.map((n) => n.title)).toEqual(['Admission open']);

    // The school decides what the page shows (PRD 6.24).
    const homeNow = async () =>
      data<Record<string, unknown>>(
        await e
          .http()
          .get(`/api/public/organizations/${schools.a.org.slug}/home`)
          .expect(200),
      );
    expect(await homeNow()).toMatchObject({
      principal: null,
      admission: null,
      facts: [],
      highlights: [],
    });
    await admin()
      .patch('/api/settings/profile', {
        principalName: 'Rahima Begum',
        homePage: {
          about: 'Since 1990',
          tagline: 'Learning for life',
          principalMessage: 'Welcome to our school.',
          facts: [{ value: '1,200', label: 'Students' }],
          highlights: [{ title: 'Science labs' }],
          admission: { open: true, note: 'Class 6 to 9' },
          showNotices: false,
          showAddress: false,
        },
      })
      .expect(200);
    expect(await homeNow()).toMatchObject({
      enabled: true,
      about: 'Since 1990',
      tagline: 'Learning for life',
      heroImageUrl: null,
      principal: {
        name: 'Rahima Begum',
        photoUrl: null,
        message: 'Welcome to our school.',
      },
      facts: [{ value: '1,200', label: 'Students' }],
      highlights: [{ title: 'Science labs' }],
      admission: { note: 'Class 6 to 9' },
      address: null,
      notices: [],
    });
    await admin()
      .patch('/api/settings/profile', { homePage: { enabled: false } })
      .expect(200);
    const off = await homeNow();
    expect(off).toMatchObject({ enabled: false, name: schools.a.org.name });
    expect(off).not.toHaveProperty('notices');
    expect(off).not.toHaveProperty('contact');
  });

  it('notifies each family when results are published, and dues hold them back', async () => {
    await admin().post('/api/grading-systems/templates/bd-gpa-5').expect(201);
    const subject = await created(
      admin()
        .post('/api/subjects', { name: `Bangla ${runId}` })
        .expect(201),
    );
    await admin()
      .post('/api/class-subjects', {
        classId: ids['class-a'],
        subjectId: subject,
        academicYearId: ids['year-a'],
        subjectType: 'compulsory',
      })
      .expect(201);
    const exam = await created(
      admin()
        .post('/api/exams', {
          academicYearId: ids['year-a'],
          name: 'Half-yearly',
        })
        .expect(201),
    );
    await admin()
      .post(`/api/exams/${exam}/subjects`, { classIds: [ids['class-a']] })
      .expect(200);
    await admin().post(`/api/exams/${exam}/open`).expect(200);
    const sheets = data<{ id: string; sectionId: string }[]>(
      await admin().get(`/api/exams/${exam}/mark-sheets`).expect(200),
    );
    for (const sheet of sheets) {
      const grid = data<{
        subject: { components: { id: string }[] };
        students: { enrollmentId: string }[];
      }>(await admin().get(`/api/mark-sheets/${sheet.id}/marks`).expect(200));
      await admin()
        .put(`/api/mark-sheets/${sheet.id}/marks`, {
          entries: grid.students.map((s) => ({
            enrollmentId: s.enrollmentId,
            componentId: grid.subject.components[0].id,
            value: 75,
          })),
        })
        .expect(200);
      await admin().post(`/api/mark-sheets/${sheet.id}/submit`).expect(200);
    }
    await admin()
      .post('/api/mark-sheets/approve', {
        markSheetIds: sheets.map((s) => s.id),
      })
      .expect(200);
    await drain();
    const [definition] = data<Row[]>(
      await admin().get(`/api/result-definitions?examId=${exam}`).expect(200),
    );
    await admin()
      .post(`/api/result-definitions/${definition.id}/publish`)
      .expect(200);
    await dispatch();

    const results = (await notificationsOf(guardian)).filter(
      (n) => n.type === 'resultPublished',
    );
    expect(results.map((n) => n.data.studentId).sort()).toEqual(
      [students.s1, students.s2].sort(),
    );
    expect(results[0].link).toMatch(/^\/portal\/children\/.+\/results$/);
    expect(
      (await notificationsOf(other)).filter(
        (n) => n.type === 'resultPublished',
      ),
    ).toHaveLength(1);
    // A second run sends nothing new.
    await dispatch();
    expect(
      (await notificationsOf(guardian)).filter(
        (n) => n.type === 'resultPublished',
      ),
    ).toHaveLength(2);

    const shown = data<{
      blocked: boolean;
      results: { id: string; grade: string }[];
    }>(
      await guardian()
        .get(`/api/portal/children/${students.s1}/results`)
        .expect(200),
    );
    expect(shown).toMatchObject({ blocked: false, results: [{ grade: 'A' }] });
    ids.result = shown.results[0].id;
    await other()
      .get(`/api/portal/children/${students.s1}/results/${ids.result}`)
      .expect(404);

    // An overdue bill holds results back while blockResultsOnDues is on.
    await admin()
      .patch('/api/settings/fees', { blockResultsOnDues: true })
      .expect(200);
    ids.invoice = await created(
      admin()
        .post('/api/invoices', {
          studentId: students.s1,
          dueDate: `${Y}-01-01`,
          lines: [{ description: 'Session fee', amount: 50_000 }],
        })
        .expect(201),
    );
    const held = data<{ blocked: boolean }>(
      await guardian()
        .get(`/api/portal/children/${students.s1}/results`)
        .expect(200),
    );
    expect(held.blocked).toBe(true);
    const card = await guardian()
      .get(
        `/api/portal/children/${students.s1}/results/${ids.result}/report-card`,
      )
      .expect(403);
    expect(error(card).code).toBe('RESULTS_HELD_FOR_DUES');
  });

  it('confirms a payment to the family and lets them download the receipt', async () => {
    const receipt = data<Row>(
      await admin()
        .post('/api/payments', {
          studentId: students.s1,
          channel: 'cash',
          amount: 50_000,
        })
        .expect(201),
    );
    await dispatch();
    const paid = (await notificationsOf(guardian)).find(
      (n) => n.type === 'paymentReceived',
    );
    expect(paid?.title).toBe('Payment received: 500.00 BDT');

    const payments = data<{ receiptId: string; amount: number }[]>(
      await guardian().get('/api/portal/payments').expect(200),
    );
    expect(payments).toEqual([
      expect.objectContaining({ receiptId: receipt.id, amount: 50_000 }),
    ]);
    await other().post(`/api/portal/receipts/${receipt.id}/pdf`).expect(404);
    const job = data<Row>(
      await guardian()
        .post(`/api/portal/receipts/${receipt.id}/pdf`)
        .expect(202),
    );
    await drain();
    const done = data<{ status: string }>(
      await guardian().get(`/api/jobs/${job.id}`).expect(200),
    );
    expect(done.status).toBe('succeeded');

    // Paid up: results are back.
    const shown = data<{ blocked: boolean }>(
      await guardian()
        .get(`/api/portal/children/${students.s1}/results`)
        .expect(200),
    );
    expect(shown.blocked).toBe(false);
  });

  it('applies for leave from the portal', async () => {
    const leave = data<{ status: string; appliedByUserId: string }>(
      await guardian()
        .post(`/api/portal/children/${students.s2}/leave`, {
          fromDate: today,
          reason: 'Fever',
        })
        .expect(201),
    );
    expect(leave).toMatchObject({
      status: 'pending',
      appliedByUserId: ids.guardianUser,
    });
    await guardian()
      .post(`/api/portal/children/${students.s3}/leave`, {
        fromDate: today,
        reason: 'x',
      })
      .expect(404);
    const mine = data<unknown[]>(
      await guardian()
        .get(`/api/portal/children/${students.s2}/leave`)
        .expect(200),
    );
    expect(mine).toHaveLength(1);
  });

  it('logs every email with its status', async () => {
    await drain();
    const log = data<
      {
        channel: string;
        recipient: string;
        status: string;
        templateKey: string;
      }[]
    >(
      await admin()
        .get('/api/communication-log?channel=email&limit=100')
        .expect(200),
    );
    const toGuardian = log.filter((l) => l.recipient === guardianEmail);
    expect(toGuardian.length).toBeGreaterThan(0);
    expect(toGuardian.every((l) => l.status === 'sent')).toBe(true);
    expect(toGuardian.map((l) => l.templateKey)).toEqual(
      expect.arrayContaining([
        'noticePublished',
        'resultPublished',
        'paymentReceived',
      ]),
    );
    expect(e.mail.to(guardianEmail, 'deliverNotification').length).toBe(
      toGuardian.length,
    );
  });

  it('switches a guardian to their other school through a handoff', async () => {
    const schoolsList = data<{ orgId: string; children: { name: string }[] }[]>(
      await guardian().get('/api/portal/schools').expect(200),
    );
    expect(schoolsList).toEqual([
      expect.objectContaining({
        orgId: schools.b.org.id,
        children: [expect.objectContaining({ name: 'b1 Child' })],
      }),
    ]);
    const handoff = data<{ code: string; redirectUrl: string }>(
      await guardian()
        .post('/api/portal/handoff', { orgId: schools.b.org.id })
        .expect(200),
    );
    expect(handoff.redirectUrl).toContain(`/auth/handoff?code=`);
    const session = data<{ access_token: string }>(
      await e
        .http()
        .post('/api/auth/handoff')
        .set('x-tenant-id', schools.b.org.slug)
        .send({ code: handoff.code })
        .expect(200),
    );
    const there = as(session.access_token, schools.b.org);
    const children = data<Child[]>(
      await there.get('/api/portal/children').expect(200),
    );
    expect(children.map((c) => c.studentId)).toEqual([students.b1]);
  });

  it('serves the role dashboards and background report exports', async () => {
    const dash = data<{
      enrollment: { total: number };
      collection: { today: { total: number } };
      dues: { outstanding: number };
    }>(await admin().get('/api/dashboards/admin').expect(200));
    expect(dash.enrollment.total).toBe(3);
    expect(dash.collection.today.total).toBe(50_000);
    const accountant = data<{ recentPayments: unknown[] }>(
      await admin().get('/api/dashboards/accountant').expect(200),
    );
    expect(accountant.recentPayments).toHaveLength(1);
    const teacher = data<{ sections: unknown[]; pendingMarkSheets: unknown[] }>(
      await admin().get('/api/dashboards/teacher').expect(200),
    );
    expect(teacher.sections.length).toBe(2);

    const job = data<Row>(
      await admin()
        .post('/api/reports/exports', { report: 'fees.dues' })
        .expect(202),
    );
    await drain();
    const done = data<{ status: string; downloadUrl: string | null }>(
      await admin().get(`/api/jobs/${job.id}`).expect(200),
    );
    expect(done).toMatchObject({ status: 'succeeded' });
    expect(done.downloadUrl).toBeTruthy();
    const exported = await e.rootDs.query<unknown[]>(
      `SELECT 1 FROM audit_logs WHERE org_id = $1 AND action = 'data.exported' AND entity_type = 'report'`,
      [schools.a.org.id],
    );
    expect(exported).toHaveLength(1);
  });

  it('keeps notifications per user and marks them read', async () => {
    const before = data<{ unread: number }>(
      await guardian().get('/api/notifications/unread-count').expect(200),
    );
    expect(before.unread).toBeGreaterThan(0);
    await guardian().post('/api/notifications/read-all').expect(200);
    const after = data<{ unread: number }>(
      await guardian().get('/api/notifications/unread-count').expect(200),
    );
    expect(after.unread).toBe(0);
    const [someone] = await e.rootDs.query<{ id: string }[]>(
      `SELECT id FROM notifications WHERE org_id = $1 AND user_id <> $2 LIMIT 1`,
      [schools.a.org.id, ids.guardianUser],
    );
    await guardian().post(`/api/notifications/${someone.id}/read`).expect(404);
  });
});
