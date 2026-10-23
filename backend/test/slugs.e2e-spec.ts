import { randomUUID } from 'crypto';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { OrganizationSlugHistory } from '~/modules/organizations/entities/organization-slug-history.entity';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';

/**
 * School addresses (doc/domains-and-routing.md 2, backend plan 5.2): the
 * reserved list, live checks with suggestions, and renames that keep the old
 * slug redirecting (and blocked for other schools) for 12 months.
 */
describe('School slugs (e2e)', () => {
  let e: E2eApp;
  const runId = randomUUID().slice(0, 8);
  const slug = (x: string) => `e2e-slug-${x}-${runId}`;
  let org: Organization;
  let other: Organization;
  let admin: User;
  let teacher: User;
  let superAdmin: User;

  const tokenFor = async (user: User, isAdmin: boolean) => {
    const { sessionId } = await e.app
      .get(SessionService)
      .start(user.id, org.id);
    return e.jwt.sign({ sub: user.id, orgId: org.id, isAdmin, sid: sessionId });
  };
  const rename = (token: string, to: string, tenant = org.slug) =>
    e
      .http()
      .patch('/api/settings/slug')
      .set('x-tenant-id', tenant)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: to });

  beforeAll(async () => {
    e = await bootApp();
    const orgs = e.rootDs.getRepository(Organization);
    [org, other] = await orgs.save(
      ['main', 'other'].map((x) =>
        orgs.create({
          name: `E2E Slug ${x} ${runId}`,
          slug: slug(x),
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );
    const users = e.rootDs.getRepository(User);
    [admin, teacher, superAdmin] = await users.save(
      ['admin', 'teacher', 'super'].map((x) =>
        users.create({
          email: `slug-${x}-${runId}@e2e.test`,
          name: x,
          password: 'not-used',
          status: UserStatus.ACTIVE,
          isAdmin: x === 'super',
          platformRole:
            x === 'super' ? PlatformRole.SUPER_ADMIN : PlatformRole.USER,
        }),
      ),
    );
    await e.rootDs.getRepository(Membership).save(
      [admin, teacher].map((u) => ({
        orgId: org.id,
        userId: u.id,
        role: MembershipRole.MEMBER,
        isAdmin: u === admin,
        status: MembershipStatus.ACTIVE,
      })),
    );
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete([org?.id, other?.id].filter(Boolean));
      await e.rootDs
        .getRepository(User)
        .delete([admin?.id, teacher?.id, superAdmin?.id].filter(Boolean));
    }
    await e?.close();
  });

  it('serves the reserved list and checks availability with suggestions', async () => {
    const reserved = data<{ reserved: string[]; pattern: string }>(
      await e.http().get('/api/public/slugs/reserved').expect(200),
    );
    expect(reserved.reserved).toEqual(
      expect.arrayContaining(['www', 'admin', 'api']),
    );
    expect(new RegExp(reserved.pattern).test('acme')).toBe(true);

    const check = (s: string) =>
      e.http().get(`/api/public/slugs/check?slug=${s}`).expect(200);
    expect(data(await check('admin'))).toMatchObject({
      available: false,
      reason: 'reserved',
    });
    expect(data(await check('a_b'))).toMatchObject({
      available: false,
      reason: 'invalid',
    });
    const taken = data<{ reason: string; suggestions: string[] }>(
      await check(org.slug),
    );
    expect(taken.reason).toBe('taken');
    expect(taken.suggestions).toHaveLength(3);
    expect(taken.suggestions).toContain(`${org.slug}-school`);
  });

  it('renames for school admins, redirects the old slug and blocks it for others', async () => {
    const old = org.slug;
    const teacherToken = await tokenFor(teacher, false);
    await rename(teacherToken, slug('renamed')).expect(403);

    const adminToken = await tokenFor(admin, true);
    const res = await rename(adminToken, slug('renamed')).expect(200);
    expect(data(res)).toEqual({ slug: slug('renamed'), previousSlug: old });

    // The old slug answers 410 with the new one, on every tenant route.
    const moved = await e
      .http()
      .get('/api/auth/me')
      .set('x-tenant-id', old)
      .expect(410);
    expect(error(moved)).toMatchObject({
      code: 'TENANT_MOVED',
      slug: slug('renamed'),
    });
    expect(
      data(
        await e
          .http()
          .get(`/api/public/organizations/by-slug?slug=${old}`)
          .expect(200),
      ),
    ).toMatchObject({ slug: slug('renamed'), movedFrom: old });

    // Nobody else can take it while it redirects.
    const check = data<{ reason: string }>(
      await e.http().get(`/api/public/slugs/check?slug=${old}`).expect(200),
    );
    expect(check.reason).toBe('taken');
    const superToken = await e.platformToken(superAdmin.id, true);
    const claim = await e
      .http()
      .post('/api/organizations')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Squatter', slug: old })
      .expect(409);
    expect(error(claim)).toMatchObject({ code: 'SLUG_TAKEN' });

    // Once per 30 days.
    const tooSoon = await rename(
      adminToken,
      slug('again'),
      slug('renamed'),
    ).expect(409);
    expect(error(tooSoon)).toMatchObject({ code: 'SLUG_CHANGE_TOO_SOON' });

    // A month later the school may take its old slug back.
    await e.rootDs
      .getRepository(OrganizationSlugHistory)
      .update(
        { orgId: org.id },
        { createdAt: new Date(Date.now() - 31 * 86_400_000) },
      );
    await rename(adminToken, old, slug('renamed')).expect(200);
    const history = await e.rootDs
      .getRepository(OrganizationSlugHistory)
      .find({ where: { orgId: org.id } });
    expect(history.map((h) => h.slug)).toEqual([slug('renamed')]);
  });

  it('refuses a slug another school uses', async () => {
    const adminToken = await tokenFor(admin, true);
    await e.rootDs
      .getRepository(OrganizationSlugHistory)
      .update(
        { orgId: org.id },
        { createdAt: new Date(Date.now() - 31 * 86_400_000) },
      );
    const res = await rename(adminToken, other.slug).expect(409);
    expect(error(res)).toMatchObject({ code: 'SLUG_TAKEN' });
  });
});
