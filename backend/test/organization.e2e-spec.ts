import { randomUUID } from 'crypto';
import { In } from 'typeorm';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import { PlatformAuditLog } from '~/modules/audit/entities/platform-audit-log.entity';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';

interface OrgBody {
  id: string;
  slug: string;
  status: OrganizationStatus;
  trialEndsAt: string | null;
  plan?: { code: string } | null;
  limitOverrides?: Record<string, number | null> | null;
}

/**
 * Platform administration (PRD 6.1 Phase 1a, backend plan 5.1): only a
 * super-admin creates schools, changes plans, limits and trials, and each
 * change is in the platform audit log. Plan entitlements gate school
 * features right away.
 */
describe('Platform administration (e2e)', () => {
  let e: E2eApp;
  const runId = randomUUID().slice(0, 8);
  let admin: User;
  let regular: User;
  let schoolAdmin: User;
  let adminToken: string;
  let userToken: string;
  const createdOrgIds: string[] = [];

  const asAdmin = () => ({
    get: (url: string) =>
      e.http().get(url).set('Authorization', `Bearer ${adminToken}`),
    post: (url: string, body: object = {}) =>
      e
        .http()
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body),
    patch: (url: string, body: object) =>
      e
        .http()
        .patch(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body),
    put: (url: string, body: object) =>
      e.http().put(url).set('Authorization', `Bearer ${adminToken}`).send(body),
  });

  const createSchool = async (body: object) => {
    const res = await asAdmin().post('/api/organizations', body).expect(201);
    const org = data<OrgBody>(res);
    createdOrgIds.push(org.id);
    return org;
  };

  /** A tenant token for `schoolAdmin` in `org` (a school admin there). */
  const tenantToken = async (orgId: string) => {
    await e.rootDs.getRepository(Membership).save({
      orgId,
      userId: schoolAdmin.id,
      role: MembershipRole.ADMIN,
      isAdmin: true,
      status: MembershipStatus.ACTIVE,
    });
    const { sessionId } = await e.app
      .get(SessionService)
      .start(schoolAdmin.id, orgId);
    return e.jwt.sign({
      sub: schoolAdmin.id,
      orgId,
      isAdmin: true,
      sid: sessionId,
    });
  };

  beforeAll(async () => {
    e = await bootApp();
    const users = e.rootDs.getRepository(User);
    [admin, regular, schoolAdmin] = await users.save(
      ['admin', 'regular', 'school'].map((x) =>
        users.create({
          email: `orgs-${x}-${runId}@e2e.test`,
          name: x,
          password: 'not-used',
          status: UserStatus.ACTIVE,
          isAdmin: x === 'admin',
          platformRole:
            x === 'admin' ? PlatformRole.SUPER_ADMIN : PlatformRole.USER,
        }),
      ),
    );
    adminToken = await e.platformToken(admin.id, true);
    userToken = await e.platformToken(regular.id);
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      if (createdOrgIds.length) {
        await e.rootDs.getRepository(Organization).delete(createdOrgIds);
      }
      await e.rootDs
        .getRepository(User)
        .delete([admin?.id, regular?.id, schoolAdmin?.id].filter(Boolean));
    }
    await e?.close();
  });

  it('lets only a super-admin create a school, with a valid free slug', async () => {
    await e
      .http()
      .post('/api/organizations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Nope', slug: `e2e-nope-${runId}` })
      .expect(403);

    const org = await createSchool({
      name: `E2E Org ${runId}`,
      slug: `e2e-org-${runId}`,
      planCode: 'basic',
      trialDays: 15,
    });
    expect(org.status).toBe(OrganizationStatus.TRIAL);
    const trialDays =
      (new Date(org.trialEndsAt!).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(trialDays)).toBe(15);

    // Reserved and malformed slugs fail validation; a taken one is 409
    // with suggestions.
    await asAdmin()
      .post('/api/organizations', { name: 'Reserved', slug: 'admin' })
      .expect(400);
    await asAdmin()
      .post('/api/organizations', { name: 'Underscore', slug: 'acme_school' })
      .expect(400);
    const taken = await asAdmin()
      .post('/api/organizations', { name: 'Taken', slug: org.slug })
      .expect(409);
    expect(error(taken)).toMatchObject({ code: 'SLUG_TAKEN' });
    expect((error(taken).suggestions as string[]).length).toBeGreaterThan(0);
  });

  it('lists the school directory with filters for a super-admin only', async () => {
    const org = await createSchool({
      name: `E2E Directory ${runId}`,
      slug: `e2e-dir-${runId}`,
      planCode: 'premium',
    });

    const res = await asAdmin()
      .get(`/api/organizations?q=${runId}&plan=premium`)
      .expect(200);
    const rows =
      data<Array<OrgBody & { activeStudentCount: number; district: null }>>(
        res,
      );
    expect(rows.map((r) => r.id)).toEqual([org.id]);
    expect(rows[0]).toMatchObject({
      plan: { code: 'premium' },
      activeStudentCount: 0,
    });
    expect((res.body as { meta: { total: number } }).meta.total).toBe(1);

    // Anyone else sees only their own schools (none here).
    const mine = await e
      .http()
      .get('/api/organizations')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(data<unknown[]>(mine)).toEqual([]);
  });

  it('changes plans, trials and limits (super-admin only), and the plan gates features at once', async () => {
    const org = await createSchool({
      name: `E2E Plans ${runId}`,
      slug: `e2e-plans-${runId}`,
      planCode: 'standard',
    });
    const token = await tenantToken(org.id);
    const school = (method: 'get' | 'post', url: string, body?: object) =>
      e
        .http()
        [method](url)
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant-id', org.slug)
        .send(body);

    // Not a super-admin: refused.
    for (const [method, url, body] of [
      ['patch', `/api/organizations/${org.id}/plan`, { planCode: 'free' }],
      ['post', `/api/organizations/${org.id}/trial/extend`, { days: 5 }],
      ['put', `/api/organizations/${org.id}/limits`, { students: 1 }],
    ] as const) {
      await e
        .http()
        [method](url)
        .set('Authorization', `Bearer ${userToken}`)
        .send(body)
        .expect(403);
    }

    // On Standard, custom roles work.
    await school('post', '/api/roles', {
      name: `Vice principal ${runId}`,
      permissions: ['students:read'],
    }).expect(201);

    // On Free they don't, and neither do custom domains.
    const changed = await asAdmin()
      .patch(`/api/organizations/${org.id}/plan`, {
        planCode: 'free',
        addOnModules: ['transport'],
      })
      .expect(200);
    expect(data<OrgBody>(changed).plan).toMatchObject({ code: 'free' });
    for (const [url, body] of [
      ['/api/roles', { name: `Blocked ${runId}`, permissions: [] }],
      ['/api/domains', { hostname: `erp-${runId}.e2e-school.test` }],
    ] as const) {
      const res = await school('post', url, body).expect(403);
      expect(error(res)).toMatchObject({ code: 'MODULE_NOT_IN_PLAN' });
    }
    await asAdmin()
      .patch(`/api/organizations/${org.id}/plan`, {
        planCode: 'free',
        addOnModules: ['fees'],
      })
      .expect(400);

    // Not on a trial: nothing to extend.
    const notOnTrial = await asAdmin()
      .post(`/api/organizations/${org.id}/trial/extend`, { days: 5 })
      .expect(409);
    expect(error(notOnTrial)).toMatchObject({ code: 'NOT_ON_TRIAL' });

    // A limit of 0 students blocks the next admission.
    const limited = await asAdmin()
      .put(`/api/organizations/${org.id}/limits`, {
        students: 0,
        admins: null,
      })
      .expect(200);
    expect(data<OrgBody>(limited).limitOverrides).toEqual({
      students: 0,
      admins: null,
    });
    const blocked = await school('post', '/api/students', {
      admissionNumber: `A-${runId}`,
      firstName: 'Rahim',
      lastName: 'Uddin',
    }).expect(403);
    expect(error(blocked)).toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
      limit: 'students',
    });

    // Each change is in the platform audit log.
    const actions = (
      await e.rootDs.getRepository(PlatformAuditLog).find({
        where: { orgId: org.id },
        order: { createdAt: 'ASC' },
      })
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'organization.created',
        'organization.plan_changed',
        'organization.limits_changed',
      ]),
    );
  });

  it('extends a trial from its end date, and the trial grants Standard', async () => {
    const org = await createSchool({
      name: `E2E Trial ${runId}`,
      slug: `e2e-trial-${runId}`,
      trialDays: 10,
    });
    const before = new Date(org.trialEndsAt!).getTime();
    const res = await asAdmin()
      .post(`/api/organizations/${org.id}/trial/extend`, { days: 15 })
      .expect(201);
    const after = new Date(data<OrgBody>(res).trialEndsAt!).getTime();
    expect(Math.round((after - before) / 86_400_000)).toBe(15);

    // On Free, but the running trial unlocks Standard's custom roles.
    const token = await tenantToken(org.id);
    await e
      .http()
      .post('/api/roles')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', org.slug)
      .send({ name: `Trial role ${runId}`, permissions: [] })
      .expect(201);

    const audit = await e.rootDs.getRepository(PlatformAuditLog).findOneOrFail({
      where: {
        orgId: org.id,
        action: In(['organization.trial_extended']),
      },
    });
    expect(audit.actorUserId).toBe(admin.id);
  });
});
