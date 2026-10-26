import { randomUUID } from 'crypto';
import { Like } from 'typeorm';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { NCTB_TEMPLATE } from '~/shared/templates/curriculum/nctb';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { AuditLog } from '~/modules/audit/entities/audit-log.entity';
import { TENANT_POOL_DATASOURCE } from '~/tenancy/tenancy.constants';
import type { DataSource } from 'typeorm';
import { bootApp, data, error, type E2eApp } from './support/app';

interface Checklist {
  steps: { key: string; done: boolean; available: boolean }[];
  percentage: number;
  canComplete: boolean;
  completedAt: string | null;
}

/**
 * Onboarding (PRD 6.2, backend plan 5.4): the checklist is computed from
 * real data, the NCTB template applies idempotently, and "Find your school"
 * answers the same for known and unknown emails.
 */
describe('Onboarding (e2e)', () => {
  let e: E2eApp;
  const runId = randomUUID().slice(0, 8);
  let owner: User;
  let org: Organization;
  let token: string;
  let yearId: string;
  let class6Id: string;

  const school = () => ({
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
  });
  const checklist = async () =>
    data<Checklist>(
      await school().get('/api/onboarding/checklist').expect(200),
    );
  const done = (c: Checklist) =>
    c.steps.filter((s) => s.done).map((s) => s.key);

  beforeAll(async () => {
    e = await bootApp();
    const users = e.rootDs.getRepository(User);
    owner = await users.save(
      users.create({
        email: `onb-owner-${runId}@e2e.test`,
        name: 'Owner',
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    // The signup path: trial school, roles, settings row, active owner.
    org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E Onboarding ${runId}`,
        slug: `e2e-onb-${runId}`,
        type: OrganizationType.SCHOOL,
        ownerUserId: owner.id,
      }),
    );
    const { sessionId } = await e.app
      .get(SessionService)
      .start(owner.id, org.id);
    token = e.jwt.sign({
      sub: owner.id,
      orgId: org.id,
      isAdmin: true,
      sid: sessionId,
    });
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-onb-%${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`onb-%-${runId}@e2e.test`) });
    }
    await e?.close();
  });

  it('starts empty and refuses to complete before the required steps', async () => {
    const first = await checklist();
    expect(done(first)).toEqual([]);
    expect(first.percentage).toBe(0);
    expect(first.canComplete).toBe(false);
    expect(first.steps.filter((s) => !s.available)).toEqual([]);

    const refused = await school().post('/api/onboarding/complete').expect(409);
    expect(error(refused)).toMatchObject({
      code: 'ONBOARDING_INCOMPLETE',
      missing: ['profile', 'session', 'curriculum', 'classes'],
    });
  });

  it('applies the NCTB template once, adding only what is missing', async () => {
    await school()
      .patch('/api/settings/profile', {
        address: { district: 'Dhaka' },
        phone: '01712345678',
      })
      .expect(200);
    yearId = data<{ id: string }>(
      await school()
        .post('/api/academic-years', {
          name: `2027 ${runId}`,
          startDate: '2027-01-01',
          endDate: '2027-12-31',
          isCurrent: true,
        })
        .expect(201),
    ).id;
    // An existing class keeps its row (matched by name).
    class6Id = data<{ id: string }>(
      await school()
        .post('/api/classes', { name: 'Class 6', level: 6 })
        .expect(201),
    ).id;

    const first = data<{ created: Record<string, number> }>(
      await school()
        .post('/api/onboarding/templates/curriculum/nctb/apply')
        .expect(200),
    );
    expect(first.created).toMatchObject({
      subjects: NCTB_TEMPLATE.subjects.length,
      classes: 9,
      subjectGroups: 3,
      groupSubjects: 14,
      classSubjectGroups: 6,
    });
    // Class 9–10 also get their group subjects (Physics, …) as class
    // subjects, with the SSC components.
    expect(first.created.classSubjects).toBe(138);
    expect(first.created.components).toBeGreaterThan(0);

    const again = data<{ created: Record<string, number> }>(
      await school()
        .post('/api/onboarding/templates/curriculum/nctb/apply')
        .expect(200),
    );
    expect(Object.values(again.created).every((n) => n === 0)).toBe(true);

    await school()
      .post('/api/onboarding/templates/curriculum/unknown/apply')
      .expect(404);

    // One curriculum template per school, and the list says which.
    const templates = data<{ curriculumInUse: string | null }>(
      await school().get('/api/onboarding/templates').expect(200),
    );
    expect(templates.curriculumInUse).toBe('nctb');
    const other = await school()
      .post('/api/onboarding/templates/curriculum/cambridge/apply')
      .expect(409);
    expect((other.body as { code: string }).code).toBe(
      'CURRICULUM_TEMPLATE_IN_USE',
    );
  });

  it('computes progress from the data and completes once the required steps are done', async () => {
    // Classes need a section in the current session too.
    let list = await checklist();
    expect(done(list)).toEqual(['profile', 'session', 'curriculum']);
    await school()
      .post('/api/sections', {
        academicYearId: yearId,
        classId: class6Id,
        name: 'A',
      })
      .expect(201);

    list = await checklist();
    expect(done(list)).toEqual(['profile', 'session', 'curriculum', 'classes']);
    expect(list.percentage).toBe(57); // 4 of the 7 steps
    expect(list.canComplete).toBe(true);

    const completed = data<Checklist>(
      await school().post('/api/onboarding/complete').expect(200),
    );
    expect(completed.completedAt).not.toBeNull();

    const me = data<{ organization: { onboardingCompletedAt: string } }>(
      await school().get('/api/auth/me').expect(200),
    );
    expect(me.organization.onboardingCompletedAt).toBe(completed.completedAt);

    // In the school's own audit log (read under its RLS context).
    const pool = e.app.get<DataSource>(TENANT_POOL_DATASOURCE);
    const rows = await pool.transaction(async (m) => {
      await m.query(`SELECT set_config('app.org_id', $1, true)`, [org.id]);
      return m.getRepository(AuditLog).find({
        where: { action: 'onboarding.completed' },
      });
    });
    expect(rows).toHaveLength(1);
  });

  it('lists templates and applies a grading template once', async () => {
    const templates = data<{
      curriculum: { code: string }[];
      grading: { code: string; applicable: boolean }[];
    }>(await school().get('/api/onboarding/templates').expect(200));
    expect(templates.curriculum.map((t) => t.code)).toEqual([
      'nctb',
      'cambridge',
      'alia-madrasa',
    ]);
    expect(templates.grading[0]).toMatchObject({
      code: 'bd-gpa-5',
      applicable: true,
    });
    const apply = () =>
      school()
        .post('/api/onboarding/templates/grading/bd-gpa-5/apply')
        .expect(200);
    const first = data<{
      created: boolean;
      gradingSystem: { isDefault: boolean };
    }>(await apply());
    expect(first).toMatchObject({
      created: true,
      gradingSystem: { isDefault: true },
    });
    expect(data<{ created: boolean }>(await apply()).created).toBe(false);
    expect(done(await checklist())).toContain('grading');
  });

  it('switches the curriculum template: the old one goes, the new one comes, own classes stay', async () => {
    const own = data<{ id: string }>(
      await school()
        .post('/api/classes', { name: `Hifz ${runId}` })
        .expect(201),
    ).id;

    const switched = data<{
      previous: string | null;
      removed: Record<string, number>;
      created: Record<string, number>;
    }>(
      await school()
        .post('/api/onboarding/templates/curriculum/cambridge/switch')
        .expect(200),
    );
    expect(switched.previous).toBe('nctb');
    // NCTB's ten classes (Class 6 with its section) and its subjects.
    expect(switched.removed.classes).toBe(10);
    expect(switched.removed.subjects).toBeGreaterThan(0);
    expect(switched.created.classes).toBeGreaterThan(0);
    expect(switched.created.classSubjects).toBeGreaterThan(0);

    const classes = data<{ id: string; name: string }[]>(
      await school().get('/api/classes?limit=100').expect(200),
    );
    const names = classes.map((c) => c.name);
    expect(names).toContain('Year 1');
    expect(names.some((n) => n.startsWith('Class '))).toBe(false);
    expect(classes.some((c) => c.id === own)).toBe(true);
    expect(
      data<{ curriculumInUse: string }>(
        await school().get('/api/onboarding/templates').expect(200),
      ).curriculumInUse,
    ).toBe('cambridge');
  });

  it('"Find your school" answers the same for known and unknown emails', async () => {
    const find = (email: string) =>
      e.http().post('/api/public/find-school').send({ email }).expect(202);
    const unknownEmail = `onb-nobody-${runId}@e2e.test`;

    const known = await find(owner.email!.toUpperCase());
    const unknown = await find(unknownEmail);
    expect(known.body).toEqual(unknown.body);

    await e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
    expect(e.mail.to(unknownEmail)).toEqual([]);
    const [mail] = e.mail.to(owner.email!, 'sendFindSchoolEmail');
    const { schools } = mail.args[0] as {
      schools: { name: string; link: string }[];
    };
    expect(schools).toHaveLength(1);
    const link = new URL(schools[0].link);
    expect(link.hostname).toBe(`${org.slug}.lvh.me`);
    expect(link.pathname).toBe('/login');
    expect(link.searchParams.get('identifier')).toBe(owner.email);
  });
});
