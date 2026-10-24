import { randomInt, randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { Like } from 'typeorm';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
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
interface SheetRow {
  id: string;
  subjectName: string;
  sectionName: string;
  status: string;
}
interface Grid {
  subject: { components: { id: string; component: string }[] };
  students: {
    enrollmentId: string;
    complete: boolean;
    computed: { letter: string; passed: boolean; failedComponents: string[] };
  }[];
}
interface DefinitionView {
  id: string;
  examId: string | null;
  status: {
    sheets: number;
    approved: number;
    allApproved: boolean;
    current: boolean;
    published: boolean;
  };
}
interface ResultRow {
  id: string;
  enrollmentId: string;
  gpa: number | null;
  grade: string;
  passed: boolean;
  positionClass: number | null;
  positionSection: number | null;
  publishedAt: string | null;
}
interface JobView {
  status: string;
  result: Record<string, unknown> | null;
  downloadUrl: string | null;
  error: string | null;
}

/**
 * M5 acceptance (backend plan 9, PRD 6.9): mark entry with grades as you
 * type, the sheet workflow with and without the verify step, approved
 * sheets read-only and reopen audited with old and new values, automatic
 * tabulation, publish only while current, combined results, the marks
 * import, report cards and result sheets, scope and tenant isolation.
 */
describe('Exams and results (e2e)', () => {
  let e: E2eApp;
  const storage = new MemoryStorage();
  const runId = randomUUID().slice(0, 8);
  const phone = `01${randomInt(3, 10)}${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
  const Y = new Date().getFullYear();

  const schools: Record<'a' | 'b', { org: Organization; token: string }> =
    {} as never;
  let teacherToken: string;
  const ids: Record<string, string> = {};
  const enrollments: Record<string, string> = {};
  const students: Record<string, string> = {};

  const as = (token: string, org: Organization) => {
    const req = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      url: string,
    ) =>
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
      upload: (url: string) => req('post', url),
    };
  };
  const admin = () => as(schools.a.token, schools.a.org);
  const teacher = () => as(teacherToken, schools.a.org);
  const drain = () => e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
  const created = async (res: Promise<{ body: unknown }>) =>
    data<Row>(await res).id;
  const job = async (id: string) => {
    await drain();
    return data<JobView>(await admin().get(`/api/jobs/${id}`).expect(200));
  };

  /** Mark sheet ids by `<exam>:<subject>:<section>`. */
  const sheets: Record<string, string> = {};
  const components: Record<string, Record<string, string>> = {};

  async function makeSchool(key: 'a' | 'b') {
    const users = e.rootDs.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `m5-${key}-${runId}@e2e.test`,
        name: `Owner ${key}`,
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    const org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E M5 ${key} ${runId}`,
        slug: `e2e-m5-${key}-${runId}`,
        type: OrganizationType.SCHOOL,
        ownerUserId: owner.id,
      }),
    );
    const { sessionId } = await e.app
      .get(SessionService)
      .start(owner.id, org.id);
    schools[key] = {
      org,
      token: e.jwt.sign({
        sub: owner.id,
        orgId: org.id,
        isAdmin: true,
        sid: sessionId,
      }),
    };
  }

  async function enrol(key: string, section: string, roll: string) {
    students[key] = await created(
      admin()
        .post('/api/students', {
          classId: ids.class9,
          firstName: key,
          lastName: 'Student',
        })
        .expect(201),
    );
    enrollments[key] = await created(
      admin()
        .post('/api/enrollments', {
          studentId: students[key],
          academicYearId: ids.year,
          classId: ids.class9,
          sectionId: ids[section],
          rollNo: roll,
        })
        .expect(201),
    );
  }

  async function classSubject(
    name: string,
    subjectType: string,
    parts: { component: string; fullMarks: number; passMarks?: number }[],
  ) {
    const subject = await created(
      admin()
        .post('/api/subjects', { name: `${name} ${runId}` })
        .expect(201),
    );
    const id = await created(
      admin()
        .post('/api/class-subjects', {
          classId: ids.class9,
          subjectId: subject,
          academicYearId: ids.year,
          subjectType,
        })
        .expect(201),
    );
    for (const part of parts) {
      await admin()
        .post(`/api/class-subjects/${id}/components`, part)
        .expect(201);
    }
    ids[`${name}Subject`] = subject;
    ids[name] = id;
  }

  /** Every sheet of an exam, by subject and section. */
  async function loadSheets(exam: string) {
    const rows = data<SheetRow[]>(
      await admin().get(`/api/exams/${ids[exam]}/mark-sheets`).expect(200),
    );
    for (const r of rows) {
      const subject = r.subjectName.replace(` ${runId}`, '');
      sheets[`${exam}:${subject}:${r.sectionName}`] = r.id;
    }
    return rows;
  }

  /** Component ids of a sheet by code. */
  async function parts(sheet: string) {
    const grid = data<Grid>(
      await admin().get(`/api/mark-sheets/${sheet}/marks`).expect(200),
    );
    components[sheet] = Object.fromEntries(
      grid.subject.components.map((c) => [c.component, c.id]),
    );
    return components[sheet];
  }

  /** `{ student: { component: value | 'AB' } }` → PUT entries. */
  const enter = (
    who: () => ReturnType<typeof admin>,
    sheet: string,
    marks: Record<string, Record<string, number | 'AB'>>,
  ) => ({
    expect: async (status: number) => {
      const c = components[sheet] ?? (await parts(sheet));
      const entries = Object.entries(marks).flatMap(([student, cells]) =>
        Object.entries(cells).map(([code, v]) => ({
          enrollmentId: enrollments[student],
          componentId: c[code],
          ...(v === 'AB' ? { absent: true } : { value: v }),
        })),
      );
      return who()
        .put(`/api/mark-sheets/${sheet}/marks`, { entries })
        .expect(status);
    },
  });

  const definitionOf = async (exam: string) =>
    data<DefinitionView[]>(
      await admin()
        .get(`/api/result-definitions?examId=${ids[exam]}`)
        .expect(200),
    )[0];

  const results = async (definition: string) =>
    Object.fromEntries(
      data<ResultRow[]>(
        await admin()
          .get(`/api/result-definitions/${definition}/results`)
          .expect(200),
      ).map((r) => [
        Object.keys(enrollments).find(
          (k) => enrollments[k] === r.enrollmentId,
        )!,
        r,
      ]),
    );

  beforeAll(async () => {
    e = await bootApp(withMemoryStorage(storage), { PDF_NO_SANDBOX: 'true' });
    await makeSchool('a');
    await makeSchool('b');

    ids.year = await created(
      admin()
        .post('/api/academic-years', {
          name: `${Y}`,
          startDate: `${Y}-01-01`,
          endDate: `${Y}-12-31`,
          isCurrent: true,
        })
        .expect(201),
    );
    ids.class9 = await created(
      admin().post('/api/classes', { name: 'Class 9', level: 9 }).expect(201),
    );
    for (const name of ['A', 'B']) {
      ids[name] = await created(
        admin()
          .post('/api/sections', {
            academicYearId: ids.year,
            classId: ids.class9,
            name,
          })
          .expect(201),
      );
    }
    await classSubject('Bangla', 'compulsory', [
      { component: 'written', fullMarks: 100 },
    ]);
    await classSubject('Physics', 'compulsory', [
      { component: 'cq', fullMarks: 70, passMarks: 23 },
      { component: 'mcq', fullMarks: 30, passMarks: 10 },
    ]);
    await classSubject('Agriculture', 'fourth', [
      { component: 'written', fullMarks: 100 },
    ]);
    await enrol('s1', 'A', '1');
    await enrol('s2', 'A', '2');
    await enrol('s3', 'A', '3');
    await enrol('b1', 'B', '1');
    for (const key of ['s1', 's2']) {
      await admin()
        .post(`/api/enrollments/${enrollments[key]}/subjects`, {
          subjectId: ids.AgricultureSubject,
          isFourthSubject: true,
        })
        .expect(201);
    }

    // A teacher who teaches Physics in 9A only.
    const roles = data<{ id: string; name: string }[]>(
      await admin().get('/api/roles?limit=100').expect(200),
    );
    const employee = await created(
      admin()
        .post('/api/employees', { firstName: 'Karim', lastName: 'Sir', phone })
        .expect(201),
    );
    await admin()
      .post('/api/subject-teachers', {
        sectionId: ids.A,
        classSubjectId: ids.Physics,
        employeeId: employee,
      })
      .expect(201);
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
        .delete({ slug: Like(`e2e-m5-%-${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`m5-%-${runId}@e2e.test`) });
      await e.rootDs.query(`DELETE FROM users WHERE phone = $1`, [
        `+880${phone.slice(1)}`,
      ]);
    }
    await e?.close();
  });

  it('creates grading from a template and sets up two exams', async () => {
    const system = data<{ isDefault: boolean; items: unknown[] }>(
      await admin().post('/api/grading-systems/templates/bd-gpa-5').expect(201),
    );
    expect(system).toMatchObject({ isDefault: true });
    expect(system.items).toHaveLength(7);

    for (const [key, name, weight] of [
      ['half', 'Half-yearly', 30],
      ['annual', 'Annual', 70],
    ] as const) {
      ids[key] = await created(
        admin()
          .post('/api/exams', { academicYearId: ids.year, name, weight })
          .expect(201),
      );
      const subjects = data<{ fullMarks: number; components: unknown[] }[]>(
        await admin()
          .post(`/api/exams/${ids[key]}/subjects`, { classIds: [ids.class9] })
          .expect(200),
      );
      expect(subjects.map((s) => s.fullMarks).sort()).toEqual([100, 100, 100]);
      await admin().post(`/api/exams/${ids[key]}/open`).expect(200);
      expect(await loadSheets(key)).toHaveLength(6);
    }
  });

  it('keeps a subject teacher to the subjects they teach', async () => {
    const physicsA = sheets['annual:Physics:A'];
    await teacher().get(`/api/mark-sheets/${physicsA}/marks`).expect(200);
    const other = await enter(teacher, sheets['annual:Bangla:A'], {
      s1: { written: 50 },
    }).expect(403);
    expect(error(other).code).toBe('NOT_SUBJECT_TEACHER');
    await enter(teacher, sheets['annual:Physics:B'], {
      b1: { cq: 40 },
    }).expect(404);
    await enter(teacher, physicsA, { s1: { cq: 80 } }).expect(400);
  });

  it('grades as marks are entered and refuses an incomplete submit', async () => {
    const physicsA = sheets['annual:Physics:A'];
    const grid = data<Grid>(
      await enter(teacher, physicsA, {
        s1: { cq: 60, mcq: 25 },
        s2: { cq: 50, mcq: 8 },
      }).expect(200),
    );
    const byKey = (k: string) =>
      grid.students.find((s) => s.enrollmentId === enrollments[k])!;
    expect(byKey('s1').computed).toMatchObject({ letter: 'A+', passed: true });
    expect(byKey('s2').computed).toMatchObject({
      letter: 'F',
      passed: false,
      failedComponents: ['mcq'],
    });
    const incomplete = await teacher()
      .post(`/api/mark-sheets/${physicsA}/submit`)
      .expect(409);
    expect(error(incomplete)).toMatchObject({
      code: 'MARKS_INCOMPLETE',
      enrollmentIds: [enrollments.s3],
    });
    await enter(teacher, physicsA, { s3: { cq: 'AB', mcq: 'AB' } }).expect(200);
    await teacher().post(`/api/mark-sheets/${physicsA}/submit`).expect(200);
  });

  it('imports a sheet’s marks from its prefilled template', async () => {
    const sheet = sheets['half:Bangla:A'];
    const template = await admin()
      .get(`/api/imports/templates/marks?markSheetId=${sheet}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(template.body as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.rowCount).toBe(4); // header + three students
    const marks: Record<string, number> = { '1': 90, '2': 70, '3': 40 };
    for (let r = 2; r <= ws.rowCount; r++) {
      ws.getRow(r).getCell(4).value = marks[ws.getRow(r).getCell(2).text];
    }
    const upload = data<{ import: Row; job: Row }>(
      await admin()
        .upload('/api/imports')
        .field('type', 'marks')
        .field('markSheetId', sheet)
        .attach('file', Buffer.from(await wb.xlsx.writeBuffer()), 'marks.xlsx')
        .expect(202),
    );
    expect((await job(upload.job.id)).status).toBe('succeeded');
    const commit = data<Row>(
      await admin().post(`/api/imports/${upload.import.id}/commit`).expect(202),
    );
    expect((await job(commit.id)).status).toBe('succeeded');
    const grid = data<Grid>(
      await admin().get(`/api/mark-sheets/${sheet}/marks`).expect(200),
    );
    expect(grid.students.every((s) => s.complete)).toBe(true);
  });

  it('runs a sheet to published without the verify step, tabulating by itself', async () => {
    await enter(admin, sheets['half:Bangla:B'], { b1: { written: 60 } }).expect(
      200,
    );
    await enter(admin, sheets['half:Physics:A'], {
      s1: { cq: 60, mcq: 25 },
      s2: { cq: 45, mcq: 15 },
      s3: { cq: 30, mcq: 12 },
    }).expect(200);
    await enter(admin, sheets['half:Physics:B'], {
      b1: { cq: 40, mcq: 20 },
    }).expect(200);
    await enter(admin, sheets['half:Agriculture:A'], {
      s1: { written: 85 },
      s2: { written: 50 },
    }).expect(200);
    const half = Object.entries(sheets)
      .filter(([k]) => k.startsWith('half:'))
      .map(([, id]) => id);
    for (const id of half)
      await admin().post(`/api/mark-sheets/${id}/submit`).expect(200);

    const off = await admin()
      .post(`/api/mark-sheets/${half[0]}/verify`)
      .expect(409);
    expect(error(off).code).toBe('VERIFY_STEP_OFF');
    const definition = await definitionOf('half');
    const early = await admin()
      .post(`/api/result-definitions/${definition.id}/publish`)
      .expect(409);
    expect(error(early).code).toBe('RESULTS_NOT_CURRENT');

    await admin()
      .post('/api/mark-sheets/approve', { markSheetIds: half })
      .expect(200);
    await drain();
    expect((await definitionOf('half')).status).toMatchObject({
      allApproved: true,
      current: true,
    });
    await admin()
      .post(`/api/result-definitions/${definition.id}/publish`)
      .expect(200);
    const r = await results(definition.id);
    expect(r.s1).toMatchObject({ grade: 'A+', positionClass: 1 });
    expect(r.s1.publishedAt).not.toBeNull();
  });

  it('needs the verify step when it is on; approved sheets are read-only', async () => {
    await admin()
      .patch('/api/settings/results', { verifyStep: true })
      .expect(200);
    await enter(admin, sheets['annual:Bangla:A'], {
      s1: { written: 80 },
      s2: { written: 60 },
      s3: { written: 35 },
    }).expect(200);
    await enter(admin, sheets['annual:Bangla:B'], {
      b1: { written: 50 },
    }).expect(200);
    await enter(admin, sheets['annual:Physics:B'], {
      b1: { cq: 40, mcq: 20 },
    }).expect(200);
    await enter(admin, sheets['annual:Agriculture:A'], {
      s1: { written: 90 },
      s2: { written: 45 },
    }).expect(200);
    const annual = Object.entries(sheets)
      .filter(([k]) => k.startsWith('annual:'))
      .map(([, id]) => id);
    for (const id of annual) {
      if (id === sheets['annual:Physics:A']) continue; // the teacher's, submitted
      await admin().post(`/api/mark-sheets/${id}/submit`).expect(200);
    }
    const unverified = await admin()
      .post(`/api/mark-sheets/${annual[0]}/approve`)
      .expect(409);
    expect(error(unverified).code).toBe('NOT_VERIFIED');
    for (const id of annual)
      await admin().post(`/api/mark-sheets/${id}/verify`).expect(200);
    await admin()
      .post('/api/mark-sheets/approve', { markSheetIds: annual })
      .expect(200);
    await drain();

    const locked = await enter(teacher, sheets['annual:Physics:A'], {
      s2: { mcq: 12 },
    }).expect(409);
    expect(error(locked).code).toBe('MARK_SHEET_LOCKED');

    const definition = await definitionOf('annual');
    await admin()
      .post(`/api/result-definitions/${definition.id}/publish`)
      .expect(200);
    const r = await results(definition.id);
    // s1: A+ in both, 4th subject bonus capped at 5.00; s2 failed MCQ;
    // s3 absent in Physics; b1: (3 + 3.5) / 2.
    expect(r.s1).toMatchObject({ gpa: 5, grade: 'A+', positionClass: 1 });
    expect(r.b1).toMatchObject({
      gpa: 3.25,
      grade: 'B',
      positionClass: 2,
      positionSection: 1,
    });
    expect(r.s2).toMatchObject({ passed: false, grade: 'F', gpa: 0 });
    expect(r.s3).toMatchObject({ passed: false });
  });

  it('reopens with an audited reason, keeps old and new values, and republishes', async () => {
    const physicsA = sheets['annual:Physics:A'];
    const definition = await definitionOf('annual');
    await admin()
      .post(`/api/mark-sheets/${physicsA}/reopen`, { reason: 'MCQ re-check' })
      .expect(200);
    const stale = await admin()
      .post(`/api/result-definitions/${definition.id}/publish`)
      .expect(409);
    expect(error(stale).code).toBe('RESULTS_NOT_CURRENT');

    await enter(teacher, physicsA, { s2: { mcq: 12 } }).expect(200);
    const [audit] = await e.rootDs.query<
      { before: Record<string, unknown>; after: Record<string, unknown> }[]
    >(
      `SELECT before, after FROM audit_logs
       WHERE org_id = $1 AND action = 'marks.changed' AND entity_id = $2`,
      [schools.a.org.id, physicsA],
    );
    expect(Object.values(audit.before)).toEqual([8]);
    expect(Object.values(audit.after)).toEqual([12]);
    const reopened = await e.rootDs.query<unknown[]>(
      `SELECT 1 FROM audit_logs WHERE org_id = $1 AND action = 'mark_sheet.reopened'`,
      [schools.a.org.id],
    );
    expect(reopened).toHaveLength(1);

    await teacher().post(`/api/mark-sheets/${physicsA}/submit`).expect(200);
    await admin().post(`/api/mark-sheets/${physicsA}/verify`).expect(200);
    await admin().post(`/api/mark-sheets/${physicsA}/approve`).expect(200);
    await drain();
    await admin()
      .post(`/api/result-definitions/${definition.id}/publish`)
      .expect(200);
    const r = await results(definition.id);
    // (3.5 + 3.5 + 0) / 2: the 4th subject's C adds nothing.
    expect(r.s2).toMatchObject({
      passed: true,
      gpa: 3.5,
      grade: 'A-',
      positionClass: 2,
    });
  });

  it('combines the exams by weight', async () => {
    const combined = data<DefinitionView>(
      await admin()
        .post('/api/result-definitions', {
          academicYearId: ids.year,
          classId: ids.class9,
          name: 'Session result',
          items: [
            { examId: ids.half, weight: 30 },
            { examId: ids.annual, weight: 70 },
          ],
        })
        .expect(201),
    );
    expect(combined.status).toMatchObject({
      allApproved: true,
      current: false,
    });
    const tab = data<Row>(
      await admin()
        .post(`/api/result-definitions/${combined.id}/tabulate`)
        .expect(202),
    );
    expect((await job(tab.id)).status).toBe('succeeded');
    await admin()
      .post(`/api/result-definitions/${combined.id}/publish`)
      .expect(200);
    ids.combined = combined.id;
    const r = await results(combined.id);
    expect(r.s1).toMatchObject({ grade: 'A+', positionClass: 1 });
    expect(r.s3.passed).toBe(false);

    const analysis = data<
      { subjectName: string; sat: number; absent: number }[]
    >(
      await admin()
        .get(
          `/api/result-definitions/${combined.id}/analysis?sectionId=${ids.A}`,
        )
        .expect(200),
    );
    expect(
      analysis.find((a) => a.subjectName.startsWith('Physics')),
    ).toMatchObject({
      sat: 3,
      absent: 0,
    });
  });

  it('prints report cards and exports result sheets', async () => {
    const rows = data<ResultRow[]>(
      await admin()
        .get(
          `/api/result-definitions/${ids.combined}/results?sectionId=${ids.A}`,
        )
        .expect(200),
    );
    await admin()
      .put(`/api/results/${rows[0].id}/remarks`, { remarks: 'Excellent' })
      .expect(200);
    const cards = data<Row>(
      await admin()
        .post(`/api/result-definitions/${ids.combined}/report-cards`, {
          sectionId: ids.A,
          language: 'bn',
        })
        .expect(202),
    );
    const done = await job(cards.id);
    expect(done).toMatchObject({ status: 'succeeded', result: { cards: 3 } });
    expect(done.downloadUrl).toBeTruthy();
    const link = data<{ url: string }>(
      await admin().get(`/api/results/${rows[0].id}/report-card`).expect(200),
    );
    expect(link.url).toBeTruthy();

    for (const body of [
      { type: 'merit', format: 'xlsx' },
      { type: 'tabulation', format: 'pdf' },
      { type: 'failed', format: 'xlsx' },
      { type: 'analysis', format: 'pdf' },
    ]) {
      const exp = data<Row>(
        await admin()
          .post(`/api/result-definitions/${ids.combined}/exports`, body)
          .expect(202),
      );
      expect((await job(exp.id)).status).toBe('succeeded');
    }

    const overview = data<{ results: { name: string }[] }>(
      await admin().get(`/api/students/${students.s1}/overview`).expect(200),
    );
    expect(overview.results.map((r) => r.name)).toEqual(
      expect.arrayContaining(['Session result', 'Annual', 'Half-yearly']),
    );
  });

  it("[tenant-isolation] hides another school's sheets and results", async () => {
    const other = as(schools.b.token, schools.b.org);
    await other
      .get(`/api/mark-sheets/${sheets['annual:Bangla:A']}/marks`)
      .expect(404);
    await other.get(`/api/result-definitions/${ids.combined}`).expect(404);
    await other
      .get(`/api/result-definitions/${ids.combined}/results`)
      .expect(404);
    expect(
      data<unknown[]>(await other.get('/api/result-definitions').expect(200)),
    ).toEqual([]);
  });
});
