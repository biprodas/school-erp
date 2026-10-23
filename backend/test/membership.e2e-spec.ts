import { randomUUID } from 'crypto';
import { Like } from 'typeorm';
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
import { bootApp, data, type E2eApp } from './support/app';

interface MembershipBody {
  id: string;
  userId: string;
  orgId: string;
  role: MembershipRole;
  isAdmin: boolean;
  status: MembershipStatus;
  activation?: { token: string; orgSlug: string } | null;
}

/**
 * Platform membership management (`/memberships`, platform realm): a
 * super-admin manages any school's members; a school's OWNER manages its
 * own, but never the owner role; anyone else sees only their own
 * memberships. Every change is in the platform audit log.
 */
describe('Memberships (e2e)', () => {
  let e: E2eApp;
  const runId = randomUUID().slice(0, 8);
  let org: Organization;
  let admin: User;
  let owner: User;
  let member: User;
  let target: User;
  let ownerMembership: Membership;
  let memberMembership: Membership;
  const tokens: Record<'admin' | 'owner' | 'member', string> = {
    admin: '',
    owner: '',
    member: '',
  };

  const as = (who: keyof typeof tokens) => {
    const auth = (r: ReturnType<ReturnType<E2eApp['http']>['get']>) =>
      r.set('Authorization', `Bearer ${tokens[who]}`);
    return {
      get: (url: string) => auth(e.http().get(url)),
      post: (url: string, body: object) => auth(e.http().post(url)).send(body),
      patch: (url: string, body: object) =>
        auth(e.http().patch(url)).send(body),
      delete: (url: string) => auth(e.http().delete(url)),
    };
  };

  /** A plain member of the school, for tests that change or remove one. */
  const addMember = async (
    role = MembershipRole.MEMBER,
  ): Promise<Membership> => {
    const users = e.rootDs.getRepository(User);
    const user = await users.save(
      users.create({
        email: `mem-extra-${randomUUID().slice(0, 8)}-${runId}@e2e.test`,
        name: 'Extra',
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    return e.rootDs.getRepository(Membership).save({
      orgId: org.id,
      userId: user.id,
      role,
      isAdmin: role !== MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
    });
  };

  const auditActions = async (entityId: string) =>
    (
      await e.rootDs.getRepository(PlatformAuditLog).find({
        where: { entityId },
        order: { createdAt: 'ASC' },
      })
    ).map((r) => r.action);

  beforeAll(async () => {
    e = await bootApp();
    org = await e.rootDs.getRepository(Organization).save({
      name: `E2E Memberships ${runId}`,
      slug: `e2e-mem-${runId}`,
      status: OrganizationStatus.ACTIVE,
    });
    const users = e.rootDs.getRepository(User);
    [admin, owner, member, target] = await users.save(
      ['admin', 'owner', 'member', 'target'].map((x) =>
        users.create({
          email: `mem-${x}-${runId}@e2e.test`,
          name: x,
          password: 'not-used',
          status: UserStatus.ACTIVE,
          isAdmin: x === 'admin',
          platformRole:
            x === 'admin' ? PlatformRole.SUPER_ADMIN : PlatformRole.USER,
        }),
      ),
    );
    const memberships = e.rootDs.getRepository(Membership);
    [ownerMembership, memberMembership] = await memberships.save([
      {
        orgId: org.id,
        userId: owner.id,
        role: MembershipRole.OWNER,
        isAdmin: true,
        status: MembershipStatus.ACTIVE,
      },
      {
        orgId: org.id,
        userId: member.id,
        role: MembershipRole.MEMBER,
        isAdmin: false,
        status: MembershipStatus.ACTIVE,
      },
    ]);
    tokens.admin = await e.platformToken(admin.id, true);
    tokens.owner = await e.platformToken(owner.id);
    tokens.member = await e.platformToken(member.id);
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      if (org?.id) await e.rootDs.getRepository(Organization).delete(org.id);
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`mem-%-${runId}@e2e.test`) });
    }
    await e?.close();
  });

  describe('authentication', () => {
    it('returns 401 without a token', async () => {
      await e.http().get('/api/memberships').expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await e
        .http()
        .get('/api/memberships')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('refuses a school token on the platform route', async () => {
      const { sessionId } = await e.app
        .get(SessionService)
        .start(owner.id, org.id);
      const schoolToken = e.jwt.sign({
        sub: owner.id,
        orgId: org.id,
        isAdmin: true,
        sid: sessionId,
      });
      await e
        .http()
        .get('/api/memberships')
        .set('Authorization', `Bearer ${schoolToken}`)
        .expect(401);
    });
  });

  describe('GET /memberships', () => {
    it('lets a super-admin filter any school', async () => {
      const rows = data<MembershipBody[]>(
        await as('admin').get(`/api/memberships?orgId=${org.id}`).expect(200),
      );
      expect(rows.map((m) => m.userId)).toEqual(
        expect.arrayContaining([owner.id, member.id]),
      );
    });

    it('shows anyone else only their own memberships', async () => {
      const rows = data<MembershipBody[]>(
        await as('member').get(`/api/memberships?orgId=${org.id}`).expect(200),
      );
      expect(rows.map((m) => m.id)).toEqual([memberMembership.id]);
    });

    it("refuses another user's memberships", async () => {
      await as('member')
        .get(`/api/memberships?userId=${target.id}`)
        .expect(403);
    });
  });

  describe('GET /memberships/organization/:orgId', () => {
    it('lists a school for a super-admin and for its owner', async () => {
      for (const who of ['admin', 'owner'] as const) {
        const rows = data<MembershipBody[]>(
          await as(who)
            .get(`/api/memberships/organization/${org.id}`)
            .expect(200),
        );
        expect(rows.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('refuses a plain member', async () => {
      await as('member')
        .get(`/api/memberships/organization/${org.id}`)
        .expect(403);
    });

    it('answers 404 for an unknown school', async () => {
      await as('admin')
        .get(`/api/memberships/organization/${randomUUID()}`)
        .expect(404);
    });
  });

  describe('GET /memberships/user/:userId and /me', () => {
    it('lets a user read their own', async () => {
      const own = data<MembershipBody[]>(
        await as('member')
          .get(`/api/memberships/user/${member.id}`)
          .expect(200),
      );
      expect(own.map((m) => m.id)).toEqual([memberMembership.id]);
      const me = data<MembershipBody[]>(
        await as('member').get('/api/memberships/me').expect(200),
      );
      expect(me.map((m) => m.id)).toEqual([memberMembership.id]);
    });

    it("refuses another user's, except to a super-admin", async () => {
      await as('member').get(`/api/memberships/user/${target.id}`).expect(403);
      expect(
        data<unknown[]>(
          await as('admin')
            .get(`/api/memberships/user/${target.id}`)
            .expect(200),
        ),
      ).toEqual([]);
    });
  });

  describe('POST /memberships', () => {
    it('lets the owner add a member, but not twice', async () => {
      const res = await as('owner')
        .post('/api/memberships', {
          userId: target.id,
          orgId: org.id,
          role: MembershipRole.MEMBER,
        })
        .expect(201);
      const created = data<MembershipBody>(res);
      expect(created).toMatchObject({
        userId: target.id,
        role: MembershipRole.MEMBER,
        isAdmin: false,
        activation: null,
      });
      expect(await auditActions(created.id)).toEqual(['membership.created']);

      await as('admin')
        .post('/api/memberships', { userId: target.id, orgId: org.id })
        .expect(409);
    });

    it('refuses a plain member, and an owner creating an owner', async () => {
      const body = {
        userId: admin.id,
        orgId: org.id,
        role: MembershipRole.MEMBER,
      };
      await as('member').post('/api/memberships', body).expect(403);
      await as('owner')
        .post('/api/memberships', { ...body, role: MembershipRole.OWNER })
        .expect(403);
    });

    it('lets a super-admin add an admin; a second owner is refused', async () => {
      const users = e.rootDs.getRepository(User);
      const newcomer = await users.save(
        users.create({
          email: `mem-newcomer-${runId}@e2e.test`,
          name: 'Newcomer',
          password: 'not-used',
          status: UserStatus.ACTIVE,
        }),
      );
      const created = data<MembershipBody>(
        await as('admin')
          .post('/api/memberships', {
            userId: newcomer.id,
            orgId: org.id,
            role: MembershipRole.ADMIN,
          })
          .expect(201),
      );
      expect(created).toMatchObject({
        role: MembershipRole.ADMIN,
        isAdmin: true,
      });

      // The school already has an owner: ownership moves by transfer only.
      await e.rootDs.getRepository(Membership).delete(created.id);
      await as('admin')
        .post('/api/memberships', {
          userId: newcomer.id,
          orgId: org.id,
          role: MembershipRole.OWNER,
        })
        .expect(409);
    });

    it('answers 404 for an unknown school or user', async () => {
      await as('admin')
        .post('/api/memberships', { userId: target.id, orgId: randomUUID() })
        .expect(404);
      await as('admin')
        .post('/api/memberships', { userId: randomUUID(), orgId: org.id })
        .expect(404);
    });
  });

  describe('PATCH /memberships/:id', () => {
    it('lets the owner make a member an admin, audited', async () => {
      const m = await addMember();
      const updated = data<MembershipBody>(
        await as('owner')
          .patch(`/api/memberships/${m.id}`, { role: MembershipRole.ADMIN })
          .expect(200),
      );
      expect(updated).toMatchObject({
        role: MembershipRole.ADMIN,
        isAdmin: true,
      });
      expect(await auditActions(m.id)).toEqual(['membership.updated']);
    });

    it('signs a demoted admin out of the school', async () => {
      const m = await addMember(MembershipRole.ADMIN);
      const sessions = e.app.get(SessionService);
      const { sessionId } = await sessions.start(m.userId, org.id);

      await as('owner')
        .patch(`/api/memberships/${m.id}`, { role: MembershipRole.MEMBER })
        .expect(200);
      expect(await sessions.isActive(sessionId)).toBe(false);
    });

    it('keeps the owner role away from owners and plain members', async () => {
      const m = await addMember();
      await as('owner')
        .patch(`/api/memberships/${m.id}`, { role: MembershipRole.OWNER })
        .expect(403);
      await as('owner')
        .patch(`/api/memberships/${ownerMembership.id}`, {
          role: MembershipRole.ADMIN,
        })
        .expect(403);
      await as('member')
        .patch(`/api/memberships/${m.id}`, { role: MembershipRole.ADMIN })
        .expect(403);
    });

    it('refuses a second owner even for a super-admin', async () => {
      const m = await addMember();
      await as('admin')
        .patch(`/api/memberships/${m.id}`, { role: MembershipRole.OWNER })
        .expect(409);
    });
  });

  describe('DELETE /memberships/:id', () => {
    it('lets the owner remove a member and ends their school sessions', async () => {
      const m = await addMember();
      const sessions = e.app.get(SessionService);
      const { sessionId } = await sessions.start(m.userId, org.id);

      await as('owner').delete(`/api/memberships/${m.id}`).expect(200);
      expect(
        await e.rootDs
          .getRepository(Membership)
          .exists({ where: { id: m.id } }),
      ).toBe(false);
      expect(await sessions.isActive(sessionId)).toBe(false);
      expect(await auditActions(m.id)).toEqual(['membership.removed']);
    });

    it("refuses removing the owner (except a super-admin) and anyone's by a plain member", async () => {
      await as('owner')
        .delete(`/api/memberships/${ownerMembership.id}`)
        .expect(403);
      const m = await addMember();
      await as('member').delete(`/api/memberships/${m.id}`).expect(403);
      await as('admin').delete(`/api/memberships/${m.id}`).expect(200);
    });
  });
});
