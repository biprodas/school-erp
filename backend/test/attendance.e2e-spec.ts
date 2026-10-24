import { randomInt, randomUUID } from 'crypto';
import { Like } from 'typeorm';
import { addDays, localDate } from '~/shared/dates/local-date';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';
import { MemoryStorage, withMemoryStorage } from './support/storage';

jest.setTimeout(180_000);

interface Row {
  id: string;
  [key: string]: unknown;
}
interface Entry {
  enrollmentId: string;
  status: string;
  onLeave: boolean;
  recorded: boolean;
}
interface Roster {
  register: { id: string } | null;
  dayOff: { reason: string } | null;
  locked: boolean;
  students: Entry[];
  summary: Record<string, number>;
}

/** Friday is the default weekend day. */
const isFriday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 5;
const schoolDay = (d: string) => (isFriday(d) ? addDays(d, -1) : d);

/**
 * M4 acceptance (backend plan 8, PRD 6.7): roster and exceptions-only
 * submit (idempotent), submission tracking, corrections with the original
 * kept and audited, holiday and weekend block, the lock window, scope,
 * leave approval into the registers, reports and the register PDF, and
 * 50 students saved in under a second.
 */
describe('Attendance and student leave (e2e)', () => {
  let e: E2eApp;
  const storage = new MemoryStorage();
  const runId = randomUUID().slice(0, 8);
  const phone = `01${randomInt(3, 10)}${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

  const today = localDate('Asia/Dhaka');
  const d0 = schoolDay(today);
  const d1 = schoolDay(addDays(d0, -1));
  const old = schoolDay(addDays(today, -10));
  let friday = today;
  while (!isFriday(friday)) friday = addDays(friday, -1);
  const Y = Number(today.slice(0, 4));

  const schools: Record<'a' | 'b', { org: Organization; token: string }> =
    {} as never;
  let teacherToken: string;
  const ids: Record<string, string> = {};
  const enrollments: Record<string, string> = {};

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
      delete: (url: string) => req('delete', url),
    };
  };
  const admin = () => as(schools.a.token, schools.a.org);
  const teacher = () => as(teacherToken, schools.a.org);
  const drain = () => e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
  const created = async (res: Promise<{ body: unknown }>) =>
    data<Row>(await res).id;
  const register = (section: string, date: string) =>
    `/api/attendance/sections/${ids[section]}?date=${date}`;
  const statusOf = (roster: Roster, key: string) =>
    roster.students.find((s) => s.enrollmentId === enrollments[key])!;

  async function makeSchool(key: 'a' | 'b') {
    const users = e.rootDs.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `m4-${key}-${runId}@e2e.test`,
        name: `Owner ${key}`,
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    const org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E M4 ${key} ${runId}`,
        slug: `e2e-m4-${key}-${runId}`,
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
    const student = await created(
      admin()
        .post('/api/students', {
          classId: ids.class6,
          firstName: key,
          lastName: 'Student',
        })
        .expect(201),
    );
    enrollments[key] = await created(
      admin()
        .post('/api/enrollments', {
          studentId: student,
          academicYearId: ids.year,
          classId: ids.class6,
          sectionId: ids[section],
          rollNo: roll,
        })
        .expect(201),
    );
  }

  beforeAll(async () => {
    e = await bootApp(withMemoryStorage(storage), { PDF_NO_SANDBOX: 'true' });
    await makeSchool('a');
    await makeSchool('b');

    // One session from last January, so the lock-window day is inside it.
    ids.year = await created(
      admin()
        .post('/api/academic-years', {
          name: `${Y - 1}-${Y}`,
          startDate: `${Y - 1}-01-01`,
          endDate: `${Y}-12-31`,
          isCurrent: true,
        })
        .expect(201),
    );
    ids.class6 = await created(
      admin().post('/api/classes', { name: 'Class 6', level: 6 }).expect(201),
    );
    for (const name of ['A', 'B', 'C']) {
      ids[name] = await created(
        admin()
          .post('/api/sections', {
            academicYearId: ids.year,
            classId: ids.class6,
            name,
          })
          .expect(201),
      );
    }
    await enrol('s1', 'A', '1');
    await enrol('s2', 'A', '2');
    await enrol('s3', 'A', '3');
    await enrol('b1', 'B', '1');

    // A class teacher of 6A with the plain class_teacher role.
    const roles = data<{ id: string; name: string }[]>(
      await admin().get('/api/roles?limit=100').expect(200),
    );
    const employee = await created(
      admin()
        .post('/api/employees', {
          firstName: 'Rina',
          lastName: 'Teacher',
          phone,
        })
        .expect(201),
    );
    await admin()
      .post('/api/class-teachers', {
        sectionId: ids.A,
        employeeId: employee,
      })
      .expect(201);
    const invite = data<{ userId: string }>(
      await admin()
        .post(`/api/employees/${employee}/invite`, {
          roleIds: [roles.find((r) => r.name === 'class_teacher')!.id],
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
        .delete({ slug: Like(`e2e-m4-%-${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`m4-%-${runId}@e2e.test`) });
      await e.rootDs.query(`DELETE FROM users WHERE phone = $1`, [
        `+880${phone.slice(1)}`,
      ]);
    }
    await e?.close();
  });

  it('lists the system statuses and adds the school’s own', async () => {
    await admin()
      .post('/api/attendance/statuses', {
        code: 'sick',
        labelEn: 'Sick',
        labelBn: 'অসুস্থ',
        countsAs: 'leave',
        symbol: 'S',
      })
      .expect(201);
    const clash = await admin()
      .post('/api/attendance/statuses', {
        code: 'absent',
        labelEn: 'x',
        labelBn: 'x',
        countsAs: 'absent',
        symbol: 'X',
      })
      .expect(409);
    expect(error(clash).code).toBe('STATUS_CODE_TAKEN');
    const statuses = data<{ code: string; isSystem: boolean }[]>(
      await teacher().get('/api/attendance/statuses').expect(200),
    );
    expect(statuses.map((s) => s.code)).toEqual([
      'present',
      'absent',
      'late',
      'leave',
      'half_day',
      'sick',
    ]);
  });

  it('shows everyone present, then saves the exceptions once per key', async () => {
    const before = data<Roster>(
      await admin().get(register('A', d0)).expect(200),
    );
    expect(before.register).toBeNull();
    expect(before.students.map((s) => s.status)).toEqual([
      'present',
      'present',
      'present',
    ]);

    const key = randomUUID();
    const body = {
      records: [{ enrollmentId: enrollments.s2, status: 'absent' }],
    };
    const first = data<Roster>(
      await admin()
        .put(register('A', d0), body)
        .set('Idempotency-Key', key)
        .expect(200),
    );
    expect(first.summary).toMatchObject({ present: 2, absent: 1, total: 3 });
    expect(first.students.every((s) => s.recorded)).toBe(true);
    const retry = data<Roster>(
      await admin()
        .put(register('A', d0), body)
        .set('Idempotency-Key', key)
        .expect(200),
    );
    expect(retry.register!.id).toBe(first.register!.id);

    const [{ count }] = await e.rootDs.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM attendance_records WHERE register_id = $1`,
      [first.register!.id],
    );
    expect(count).toBe(3);
    const events = await e.rootDs.query<
      { payload: { absentEnrollmentIds: string[] } }[]
    >(
      `SELECT payload FROM domain_events WHERE org_id = $1 AND type = 'attendance.submitted'`,
      [schools.a.org.id],
    );
    expect(events).toHaveLength(1);
    expect(events[0].payload.absentEnrollmentIds).toEqual([enrollments.s2]);
  });

  it('tracks which sections have not submitted', async () => {
    const status = data<{
      rows: { sectionId: string; status: string }[];
      totals: { submitted: number; pending: number };
    }>(
      await admin()
        .get(`/api/attendance/submission-status?date=${d0}`)
        .expect(200),
    );
    const byId = Object.fromEntries(
      status.rows.map((r) => [r.sectionId, r.status]),
    );
    expect(byId[ids.A]).toBe('submitted');
    expect(byId[ids.B]).toBe('pending');
    expect(status.totals).toMatchObject({ submitted: 1, pending: 2 });
  });

  it('needs a reason to change a submitted record, keeping the original', async () => {
    const body = {
      records: [{ enrollmentId: enrollments.s2, status: 'late' }],
    };
    const refused = await admin().put(register('A', d0), body).expect(400);
    expect(error(refused).code).toBe('CORRECTION_REASON_REQUIRED');

    const saved = data<Roster>(
      await admin()
        .put(register('A', d0), { ...body, reason: 'Came in at 9:40' })
        .expect(200),
    );
    expect(statusOf(saved, 's2').status).toBe('late');
    expect(statusOf(saved, 's1').status).toBe('present');

    const corrections = data<
      { oldStatus: string; newStatus: string; reason: string }[]
    >(
      await admin()
        .get(`/api/attendance/sections/${ids.A}/corrections?date=${d0}`)
        .expect(200),
    );
    expect(corrections).toEqual([
      expect.objectContaining({
        oldStatus: 'absent',
        newStatus: 'late',
        reason: 'Came in at 9:40',
      }),
    ]);
    const audits = await e.rootDs.query<unknown[]>(
      `SELECT 1 FROM audit_logs WHERE org_id = $1 AND action = 'attendance.corrected'`,
      [schools.a.org.id],
    );
    expect(audits).toHaveLength(1);
  });

  it('refuses holidays and weekend days', async () => {
    await admin()
      .post('/api/holidays', {
        name: 'School foundation day',
        type: 'school',
        dateFrom: d1,
        classIds: [ids.class6],
      })
      .expect(201);
    const roster = data<Roster>(
      await admin().get(register('A', d1)).expect(200),
    );
    expect(roster.dayOff).toMatchObject({ reason: 'holiday' });
    const holiday = await admin()
      .put(register('A', d1), { records: [] })
      .expect(409);
    expect(error(holiday).code).toBe('ATTENDANCE_HOLIDAY');
    const weekend = await admin()
      .put(register('A', friday), { records: [] })
      .expect(409);
    expect(error(weekend).code).toBe('ATTENDANCE_HOLIDAY');

    const template = data<{ created: number; toConfirm: unknown[] }>(
      await admin()
        .post('/api/onboarding/templates/holidays/bd/apply', { year: Y + 1 })
        .expect(200),
    );
    expect(template.created).toBe(6);
    expect(template.toConfirm.length).toBeGreaterThan(0);
    const again = data<{ created: number; skipped: number }>(
      await admin()
        .post('/api/onboarding/templates/holidays/bd/apply', { year: Y + 1 })
        .expect(200),
    );
    expect(again).toMatchObject({ created: 0, skipped: 6 });
  });

  it('locks old days to holders of attendance:edit_locked', async () => {
    const refused = await teacher()
      .put(register('A', old), { records: [] })
      .expect(403);
    expect(error(refused).code).toBe('ATTENDANCE_LOCKED');
    // The school admin holds every key.
    const saved = data<Roster>(
      await admin()
        .put(register('A', old), {
          records: [{ enrollmentId: enrollments.s1, status: 'absent' }],
        })
        .expect(200),
    );
    expect(saved.locked).toBe(true);
  });

  it('keeps a class teacher to their own sections', async () => {
    await teacher().get(register('B', d0)).expect(404);
    await teacher().put(register('B', d0), { records: [] }).expect(404);
    await teacher().put(register('A', d0), { records: [] }).expect(200);
    const status = data<{ rows: { sectionId: string }[] }>(
      await teacher()
        .get(`/api/attendance/submission-status?date=${d0}`)
        .expect(200),
    );
    expect(status.rows.map((r) => r.sectionId)).toEqual([ids.A]);
  });

  it('approves leave into taken registers; overriding it needs a reason', async () => {
    const outside = await teacher()
      .post('/api/student-leaves', {
        enrollmentId: enrollments.b1,
        fromDate: d0,
        reason: 'Fever',
      })
      .expect(404);
    expect(outside.status).toBe(404);

    const leave = await created(
      teacher()
        .post('/api/student-leaves', {
          enrollmentId: enrollments.s3,
          fromDate: d0,
          reason: 'Fever',
        })
        .expect(201),
    );
    const overlap = await teacher()
      .post('/api/student-leaves', {
        enrollmentId: enrollments.s3,
        fromDate: d0,
        reason: 'Again',
      })
      .expect(409);
    expect(error(overlap).code).toBe('LEAVE_OVERLAPS');

    const approved = data<{ status: string; registersUpdated: number }>(
      await teacher()
        .post(`/api/student-leaves/${leave}/approve`, { note: 'Get well' })
        .expect(200),
    );
    expect(approved).toMatchObject({ status: 'approved', registersUpdated: 1 });
    await teacher().post(`/api/student-leaves/${leave}/reject`).expect(409);

    const roster = data<Roster>(
      await teacher().get(register('A', d0)).expect(200),
    );
    expect(statusOf(roster, 's3')).toMatchObject({
      status: 'leave',
      onLeave: true,
    });
    const override = await teacher()
      .put(register('A', d0), {
        records: [{ enrollmentId: enrollments.s3, status: 'absent' }],
      })
      .expect(400);
    expect(error(override).code).toBe('CORRECTION_REASON_REQUIRED');

    const list = data<Row[]>(
      await teacher().get('/api/student-leaves?status=approved').expect(200),
    );
    expect(list.map((l) => l.id)).toEqual([leave]);
  });

  it('reports the day, the month, defaulters and late-comers', async () => {
    const daily = data<{
      classes: {
        sections: {
          sectionId: string;
          submitted: boolean;
          percentage: number | null;
        }[];
      }[];
      school: { submitted: number };
    }>(
      await admin().get(`/api/attendance/reports/daily?date=${d0}`).expect(200),
    );
    const sixA = daily.classes[0].sections.find((s) => s.sectionId === ids.A)!;
    // s1 present, s2 late, s3 on leave.
    expect(sixA).toMatchObject({ submitted: true, percentage: 66.7 });

    const month = d0.slice(0, 7);
    const grid = data<{
      students: { enrollmentId: string; cells: string[] }[];
      days: { date: string; off: string | null }[];
    }>(
      await admin()
        .get(
          `/api/attendance/reports/monthly-register?sectionId=${ids.A}&month=${month}`,
        )
        .expect(200),
    );
    const day = grid.days.findIndex((d) => d.date === d0);
    const cells = Object.fromEntries(
      grid.students.map((s) => [s.enrollmentId, s.cells[day]]),
    );
    expect(cells[enrollments.s1]).toBe('P');
    expect(cells[enrollments.s2]).toBe('L');
    expect(cells[enrollments.s3]).toBe('LV');

    const defaulters = data<{
      rows: { enrollmentId: string; percentage: number }[];
    }>(
      await admin()
        .get(`/api/attendance/reports/defaulters?from=${old}&threshold=75`)
        .expect(200),
    );
    expect(defaulters.rows.map((r) => r.enrollmentId)).toEqual(
      expect.arrayContaining([enrollments.s1, enrollments.s3]),
    );
    expect(defaulters.rows.map((r) => r.enrollmentId)).not.toContain(
      enrollments.s2,
    );
    const late = data<{ rows: { enrollmentId: string; late: number }[] }>(
      await admin().get('/api/attendance/reports/late-comers').expect(200),
    );
    expect(late.rows).toEqual([
      expect.objectContaining({ enrollmentId: enrollments.s2, late: 1 }),
    ]);

    const job = data<Row>(
      await admin()
        .post('/api/attendance/reports/monthly-register', {
          sectionId: ids.A,
          month,
        })
        .expect(202),
    );
    await drain();
    const done = data<{ status: string; downloadUrl: string | null }>(
      await admin().get(`/api/jobs/${job.id}`).expect(200),
    );
    expect(done.status).toBe('succeeded');
    expect(done.downloadUrl).toBeTruthy();

    // The student 360 view carries the session's attendance.
    const student = data<{ studentId: string }>(
      await admin().get(`/api/enrollments/${enrollments.s1}`).expect(200),
    ).studentId;
    const overview = data<{ attendance: { days: number; absent: number } }>(
      await admin().get(`/api/students/${student}/overview`).expect(200),
    );
    expect(overview.attendance).toMatchObject({ days: 2, absent: 1 });
  });

  it('blocks deleting an enrollment that has attendance', async () => {
    await admin().delete(`/api/enrollments/${enrollments.s1}`).expect(409);
  });

  it("[tenant-isolation] hides another school's registers", async () => {
    const other = as(schools.b.token, schools.b.org);
    await other.get(register('A', d0)).expect(404);
    await other.put(register('A', d0), { records: [] }).expect(404);
    const leaves = data<Row[]>(
      await other.get('/api/student-leaves').expect(200),
    );
    expect(leaves).toEqual([]);
  });

  it('saves 50 students in under a second', async () => {
    for (let i = 1; i <= 50; i++) await enrol(`c${i}`, 'C', String(i));
    await admin().get(register('C', d0)).expect(200);
    const records = Array.from({ length: 10 }, (_, i) => ({
      enrollmentId: enrollments[`c${i * 5 + 1}`],
      status: i % 2 ? 'absent' : 'late',
    }));
    const started = Date.now();
    const saved = data<Roster>(
      await admin().put(register('C', d0), { records }).expect(200),
    );
    const elapsed = Date.now() - started;
    expect(saved.summary.total).toBe(50);
    expect(elapsed).toBeLessThan(1000);
  });
});
