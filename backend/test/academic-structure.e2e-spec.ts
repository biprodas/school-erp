import { randomUUID } from 'crypto';
import { Like } from 'typeorm';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';

interface Row {
  id: string;
  [key: string]: unknown;
}
interface SectionRow extends Row {
  name: string;
  academicYearId: string;
  classId: string;
  shift: { name: string } | null;
}
interface ClassSubjectRow extends Row {
  subjectType: string;
  subject: { name: string };
  subjectGroup: { name: string } | null;
  components: {
    id: string;
    component: string;
    fullMarks: number;
    passMarks: number;
  }[];
}
interface Counts {
  created: number;
  skipped: number;
}
interface RolloverJob {
  status: string;
  result: {
    sections: Counts;
    classSubjects: Counts;
    teachers: { classTeachers: Counts; subjectTeachers: Counts };
  };
}
interface AssignmentRow extends Row {
  employeeId: string;
  sectionId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isPrimary?: boolean;
}

/**
 * M2 acceptance (backend plan 6): a session built from the NCTB template
 * with shifts, terms, per-session sections and subject components;
 * effective-dated teacher history; rollover that copies and refuses to
 * overwrite; the staff invite; and scope rules for an assigned teacher.
 */
describe('Academic structure and staff (e2e)', () => {
  let e: E2eApp;
  const runId = randomUUID().slice(0, 8);
  // Phone-only invites create a global account: one number per run.
  const phone = `017${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  // Sessions follow the calendar so "today" falls inside the first one.
  const Y1 = new Date().getFullYear();
  const Y2 = Y1 + 1;

  const schools: Record<'a' | 'b', { org: Organization; token: string }> =
    {} as never;
  let teacherToken: string;

  const as = (token: string, org: Organization) => ({
    get: (url: string) =>
      e
        .http()
        .get(url)
        .set('x-tenant-id', org.slug)
        .set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) =>
      e
        .http()
        .post(url)
        .set('x-tenant-id', org.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    patch: (url: string, body: object) =>
      e
        .http()
        .patch(url)
        .set('x-tenant-id', org.slug)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    delete: (url: string) =>
      e
        .http()
        .delete(url)
        .set('x-tenant-id', org.slug)
        .set('Authorization', `Bearer ${token}`),
  });
  const admin = () => as(schools.a.token, schools.a.org);
  const teacher = () => as(teacherToken, schools.a.org);
  const drain = () => e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();

  /** Ids shared across the steps below (they build on each other). */
  const ids: Record<string, string> = {};

  async function makeSchool(key: 'a' | 'b') {
    const users = e.rootDs.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `m2-${key}-${runId}@e2e.test`,
        name: `Owner ${key}`,
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    const org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E M2 ${key} ${runId}`,
        slug: `e2e-m2-${key}-${runId}`,
        type: OrganizationType.SCHOOL,
        ownerUserId: owner.id,
      }),
    );
    const { sessionId } = await e.app
      .get(SessionService)
      .start(owner.id, org.id);
    const token = e.jwt.sign({
      sub: owner.id,
      orgId: org.id,
      isAdmin: true,
      sid: sessionId,
    });
    schools[key] = { org, token };
  }

  beforeAll(async () => {
    e = await bootApp();
    await makeSchool('a');
    await makeSchool('b');
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-m2-%-${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`m2-%-${runId}@e2e.test`) });
      await e.rootDs.query(`DELETE FROM users WHERE phone LIKE $1`, [
        `%${phone.slice(1)}`,
      ]);
    }
    await e?.close();
  });

  it('builds a session with shifts, terms, sections and NCTB curriculum with components', async () => {
    ids.y1 = data<Row>(
      await admin()
        .post('/api/academic-years', {
          name: `${Y1}`,
          startDate: `${Y1}-01-01`,
          endDate: `${Y1}-12-31`,
          isCurrent: true,
        })
        .expect(201),
    ).id;
    expect(
      data<Row>(await admin().get('/api/academic-years/current').expect(200))
        .id,
    ).toBe(ids.y1);
    const overlap = await admin()
      .post('/api/academic-years', {
        name: 'Overlapping',
        startDate: `${Y1}-06-01`,
        endDate: `${Y2}-05-31`,
      })
      .expect(409);
    expect(error(overlap).code).toBe('SESSION_OVERLAP');

    ids.morning = data<Row>(
      await admin()
        .post('/api/shifts', {
          name: 'Morning',
          startTime: '07:00',
          endTime: '12:00',
        })
        .expect(201),
    ).id;
    ids.day = data<Row>(
      await admin()
        .post('/api/shifts', {
          name: 'Day',
          startTime: '12:30',
          endTime: '17:00',
        })
        .expect(201),
    ).id;
    await admin()
      .post('/api/terms', {
        academicYearId: ids.y1,
        name: 'Half-yearly',
        startDate: `${Y1}-01-01`,
        endDate: `${Y1}-06-30`,
      })
      .expect(201);
    await admin()
      .post('/api/terms', {
        academicYearId: ids.y1,
        name: 'Annual',
        startDate: `${Y1}-07-01`,
        endDate: `${Y1}-12-31`,
      })
      .expect(201);
    await admin()
      .post('/api/terms', {
        academicYearId: ids.y1,
        name: 'Outside',
        startDate: `${Y2}-01-01`,
        endDate: `${Y2}-02-01`,
      })
      .expect(400);
    ids.room = data<Row>(
      await admin()
        .post('/api/rooms', { name: '101', building: 'Main', capacity: 40 })
        .expect(201),
    ).id;

    const applied = data<{ created: Record<string, number> }>(
      await admin()
        .post('/api/onboarding/templates/curriculum/nctb/apply')
        .expect(200),
    );
    expect(applied.created.components).toBeGreaterThan(0);

    const [class9] = data<Row[]>(
      await admin().get('/api/classes?name=Class 9').expect(200),
    );
    ids.class9 = class9.id;
    ids.sectionA = data<Row>(
      await admin()
        .post('/api/sections', {
          academicYearId: ids.y1,
          classId: ids.class9,
          name: 'A',
          shiftId: ids.morning,
          roomId: ids.room,
        })
        .expect(201),
    ).id;
    ids.sectionB = data<Row>(
      await admin()
        .post('/api/sections', {
          academicYearId: ids.y1,
          classId: ids.class9,
          name: 'B',
          shiftId: ids.day,
        })
        .expect(201),
    ).id;
    const dup = await admin()
      .post('/api/sections', {
        academicYearId: ids.y1,
        classId: ids.class9,
        name: 'A',
      })
      .expect(409);
    expect(error(dup).code).toBe('SECTION_NAME_TAKEN');

    const sections = data<SectionRow[]>(
      await admin()
        .get(`/api/sections?academicYearId=${ids.y1}&classId=${ids.class9}`)
        .expect(200),
    );
    expect(sections.map((s) => [s.name, s.shift?.name])).toEqual([
      ['A', 'Morning'],
      ['B', 'Day'],
    ]);

    const subjects = data<ClassSubjectRow[]>(
      await admin()
        .get(
          `/api/class-subjects?classId=${ids.class9}&academicYearId=${ids.y1}&limit=100`,
        )
        .expect(200),
    );
    const byName = new Map(subjects.map((s) => [s.subject.name, s]));
    const physics = byName.get('Physics')!;
    ids.physics = physics.id;
    expect(physics.subjectType).toBe('compulsory');
    expect(physics.subjectGroup?.name).toBe('Science');
    expect(
      physics.components.map((c) => [c.component, c.fullMarks, c.passMarks]),
    ).toEqual([
      ['cq', 50, 17],
      ['mcq', 25, 8],
      ['practical', 25, 8],
    ]);
    expect(byName.get('Higher Mathematics')?.subjectType).toBe('fourth');
    expect(byName.get('Islam and Moral Education')?.subjectType).toBe(
      'optional',
    );

    // Components can be edited per class subject.
    const english = byName.get('English 1st Paper')!;
    const [written] = english.components;
    await admin()
      .patch(`/api/class-subjects/${english.id}/components/${written.id}`, {
        passMarks: 120,
      })
      .expect(400);
  });

  it('keeps teacher history and answers who taught a subject on a past day', async () => {
    const employee = async (firstName: string, extra: object = {}) =>
      data<Row & { employeeNumber: string }>(
        await admin()
          .post('/api/employees', { firstName, lastName: 'Teacher', ...extra })
          .expect(201),
      );
    const rahman = await employee('Rahman', {
      phone,
      nid: '1234567890',
    });
    const karim = await employee('Karim');
    expect(rahman.employeeNumber).toMatch(/^EMP-\d{4}$/);
    expect(karim.employeeNumber).not.toBe(rahman.employeeNumber);
    ids.rahman = rahman.id;
    ids.karim = karim.id;

    // NID is encrypted at rest, on create and on update.
    const storedNid = async () =>
      (
        await e.rootDs.query<{ nid: string }[]>(
          'SELECT nid FROM employees WHERE id = $1',
          [ids.rahman],
        )
      )[0].nid;
    expect(await storedNid()).toMatch(/^v1:/);
    await admin()
      .patch(`/api/employees/${ids.rahman}`, { nid: '1234567890123' })
      .expect(200);
    expect(await storedNid()).toMatch(/^v1:/);
    expect(
      data<{ nid: string }>(
        await admin().get(`/api/employees/${ids.rahman}`).expect(200),
      ).nid,
    ).toBe('1234567890123');

    const first = data<AssignmentRow>(
      await admin()
        .post('/api/subject-teachers', {
          sectionId: ids.sectionA,
          classSubjectId: ids.physics,
          employeeId: ids.rahman,
        })
        .expect(201),
    );
    expect(first.effectiveFrom).toBe(`${Y1}-01-01`);

    const handedOver = data<AssignmentRow>(
      await admin()
        .patch(`/api/subject-teachers/${first.id}`, {
          employeeId: ids.karim,
          effectiveFrom: `${Y1}-06-01`,
        })
        .expect(200),
    );
    expect(handedOver.id).not.toBe(first.id);
    expect(handedOver.effectiveFrom).toBe(`${Y1}-06-01`);

    const on = async (date: string) =>
      data<AssignmentRow[]>(
        await admin()
          .get(
            `/api/subject-teachers?sectionId=${ids.sectionA}&classSubjectId=${ids.physics}&on=${date}`,
          )
          .expect(200),
      ).map((r) => r.employeeId);
    expect(await on(`${Y1}-03-01`)).toEqual([ids.rahman]);
    expect(await on(`${Y1}-05-31`)).toEqual([ids.rahman]);
    expect(await on(`${Y1}-06-01`)).toEqual([ids.karim]);

    const history = await admin()
      .delete(`/api/subject-teachers/${first.id}`)
      .expect(409);
    expect(error(history).code).toBe('ASSIGNMENT_HISTORY');
    const ended = await admin()
      .patch(`/api/subject-teachers/${first.id}`, { employeeId: ids.karim })
      .expect(409);
    expect(error(ended).code).toBe('ASSIGNMENT_ENDED');

    // Rahman is class teacher of 9A for the whole session.
    await admin()
      .post('/api/class-teachers', {
        sectionId: ids.sectionA,
        employeeId: ids.rahman,
        isPrimary: true,
      })
      .expect(201);
  });

  it('rolls a session over, never moving students, and refuses to overwrite', async () => {
    const student = data<Row>(
      await admin()
        .post('/api/students', {
          classId: ids.class9,
          firstName: 'Ana',
          lastName: 'Roy',
        })
        .expect(201),
    );
    await admin()
      .post('/api/enrollments', {
        studentId: student.id,
        academicYearId: ids.y1,
        classId: ids.class9,
        sectionId: ids.sectionA,
      })
      .expect(201);

    ids.y2 = data<Row>(
      await admin()
        .post('/api/academic-years', {
          name: `${Y2}`,
          startDate: `${Y2}-01-01`,
          endDate: `${Y2}-12-31`,
        })
        .expect(201),
    ).id;
    const rollover = (body: object) =>
      admin().post(`/api/academic-years/${ids.y2}/rollover`, {
        fromYearId: ids.y1,
        include: { sections: true, curriculum: true, teachers: true },
        ...body,
      });

    const job = data<Row>(await rollover({}).expect(202));
    await drain();
    const done = data<RolloverJob>(
      await admin().get(`/api/jobs/${job.id}`).expect(200),
    );
    expect(done.status).toBe('succeeded');
    expect(done.result.sections).toEqual({ created: 2, skipped: 0 });
    expect(done.result.teachers).toEqual({
      classTeachers: { created: 1, skipped: 0 },
      subjectTeachers: { created: 1, skipped: 0 },
    });

    const copied = data<SectionRow[]>(
      await admin()
        .get(`/api/sections?academicYearId=${ids.y2}&classId=${ids.class9}`)
        .expect(200),
    );
    expect(copied.map((s) => [s.name, s.shift?.name])).toEqual([
      ['A', 'Morning'],
      ['B', 'Day'],
    ]);
    expect(copied.map((s) => s.id)).not.toContain(ids.sectionA);
    ids.sectionA2 = copied[0].id;

    const [physics2] = data<ClassSubjectRow[]>(
      await admin()
        .get(
          `/api/class-subjects?classId=${ids.class9}&academicYearId=${ids.y2}&limit=100`,
        )
        .expect(200),
    ).filter((s) => s.subject.name === 'Physics');
    expect(physics2.components).toHaveLength(3);

    // The current teacher (Karim) moves, from the new session's first day.
    const teachers = data<AssignmentRow[]>(
      await admin()
        .get(`/api/subject-teachers?sectionId=${ids.sectionA2}`)
        .expect(200),
    );
    expect(teachers.map((t) => [t.employeeId, t.effectiveFrom])).toEqual([
      [ids.karim, `${Y2}-01-01`],
    ]);
    const [classTeacher] = data<AssignmentRow[]>(
      await admin()
        .get(`/api/class-teachers?sectionId=${ids.sectionA2}`)
        .expect(200),
    );
    expect(classTeacher).toMatchObject({
      employeeId: ids.rahman,
      isPrimary: true,
    });

    // Students stay where they were.
    expect(
      data<Row[]>(
        await admin()
          .get(`/api/enrollments?academicYearId=${ids.y2}`)
          .expect(200),
      ),
    ).toHaveLength(0);

    const refused = await rollover({}).expect(409);
    expect(error(refused)).toMatchObject({
      code: 'ROLLOVER_TARGET_NOT_EMPTY',
      taken: ['sections', 'curriculum', 'teachers'],
    });

    const merge = data<Row>(await rollover({ mode: 'merge' }).expect(202));
    await drain();
    const merged = data<RolloverJob>(
      await admin().get(`/api/jobs/${merge.id}`).expect(200),
    );
    expect(merged.status).toBe('succeeded');
    expect(merged.result.sections).toEqual({ created: 0, skipped: 2 });
    expect(merged.result.classSubjects.created).toBe(0);
  });

  it('invites an employee with the default role of their designation', async () => {
    const roles = data<{ id: string; name: string }[]>(
      await admin().get('/api/roles?limit=100').expect(200),
    );
    const teacherRole = roles.find((r) => r.name === 'teacher')!;
    const designation = data<Row>(
      await admin()
        .post('/api/designations', {
          title: 'Assistant Teacher',
          defaultRoleId: teacherRole.id,
        })
        .expect(201),
    );
    await admin()
      .patch(`/api/employees/${ids.rahman}`, { designationId: designation.id })
      .expect(200);

    // Phone only: a slip password, usable at once.
    const invite = data<{
      userId: string;
      delivery: string;
      temporaryPassword: string;
    }>(await admin().post(`/api/employees/${ids.rahman}/invite`).expect(201));
    expect(invite.delivery).toBe('slip');
    expect(invite.temporaryPassword).toHaveLength(10);

    const linked = data<{ userId: string }>(
      await admin().get(`/api/employees/${ids.rahman}`).expect(200),
    );
    expect(linked.userId).toBe(invite.userId);
    const member = data<{ roles: { name: string }[] }>(
      await admin().get(`/api/users/${invite.userId}`).expect(200),
    );
    expect(member.roles.map((r) => r.name)).toEqual(['teacher']);

    const again = await admin()
      .post(`/api/employees/${ids.rahman}/invite`)
      .expect(409);
    expect(error(again).code).toBe('EMPLOYEE_ALREADY_LINKED');

    // The teacher signs in later, having changed the slip password.
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

  it('[tenant-isolation] a scoped teacher sees only their own sections', async () => {
    // Rahman is class teacher of 9A today; his Physics ended in June, and
    // next session's rows haven't started.
    const visible = data<SectionRow[]>(
      await teacher().get('/api/sections?limit=100').expect(200),
    );
    expect(visible.map((s) => s.id)).toEqual([ids.sectionA]);
    await teacher().get(`/api/sections/${ids.sectionA}`).expect(200);
    await teacher().get(`/api/sections/${ids.sectionB}`).expect(404);
    await teacher().get(`/api/sections/${ids.sectionA2}`).expect(404);

    const classTeachers = data<AssignmentRow[]>(
      await teacher().get('/api/class-teachers?limit=100').expect(200),
    );
    expect(new Set(classTeachers.map((r) => r.sectionId))).toEqual(
      new Set([ids.sectionA]),
    );
    // Teachers read setup; they can't change it.
    await teacher()
      .post('/api/sections', {
        academicYearId: ids.y1,
        classId: ids.class9,
        name: 'C',
      })
      .expect(403);

    // Another school sees none of it.
    const other = as(schools.b.token, schools.b.org);
    await other.get(`/api/sections/${ids.sectionA}`).expect(404);
    expect(
      data<Row[]>(await other.get('/api/sections').expect(200)),
    ).toHaveLength(0);
    await other
      .post('/api/subject-teachers', {
        sectionId: ids.sectionA,
        classSubjectId: ids.physics,
        employeeId: ids.karim,
      })
      .expect(404);
  });
});
