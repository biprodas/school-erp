import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { ALL_PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';

interface TokenBody {
  data: {
    access_token: string;
    refresh_token: string;
    mustChangePassword: boolean;
  };
}

/**
 * Identity and sessions against the real database (PRD 6.3): email or phone
 * sign-in, rotating refresh tokens with reuse detection, logout, school
 * binding, lockout, and the phone-only invite → forced password change flow.
 */
describe('Auth sessions (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  const runId = randomUUID().slice(0, 8);
  const PASSWORD = 'Correct-horse-1';
  const phone = `+88017${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  let orgA: Organization;
  let orgB: Organization;
  let admin: User;
  let rateLimitBefore: string | undefined;

  const http = () => request(app.getHttpServer());
  const login = (org: Organization, identifier: string, password = PASSWORD) =>
    http()
      .post('/api/auth/login')
      .set('x-tenant-id', org.slug)
      .send({ identifier, password });
  const refresh = (org: Organization, refreshToken: string) =>
    http()
      .post('/api/auth/refresh')
      .set('x-tenant-id', org.slug)
      .send({ refreshToken });
  const me = (org: Organization, accessToken: string) =>
    http()
      .get('/api/auth/me')
      .set('x-tenant-id', org.slug)
      .set('Authorization', `Bearer ${accessToken}`);

  beforeAll(async () => {
    // The lockout test needs more sign-ins than AUTH_THROTTLE allows.
    rateLimitBefore = process.env.RATE_LIMIT_ENABLED;
    process.env.RATE_LIMIT_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    rootDs = app.get<DataSource>(getDataSourceToken());

    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save(
      ['a', 'b'].map((x) =>
        orgs.create({
          name: `E2E Auth ${x.toUpperCase()} ${runId}`,
          slug: `e2e-auth-${x}-${runId}`,
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );

    const users = rootDs.getRepository(User);
    admin = await users.save(
      users.create({
        email: `admin-${runId}@e2e.test`,
        phone,
        name: 'Auth Admin',
        password: await bcrypt.hash(PASSWORD, 4),
        status: UserStatus.ACTIVE,
      }),
    );
    // A school admin of school A only.
    await rootDs.getRepository(Membership).save({
      orgId: orgA.id,
      userId: admin.id,
      role: MembershipRole.OWNER,
      isAdmin: true,
      status: MembershipStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) await rootDs.getRepository(Organization).delete(ids);
      await rootDs
        .getRepository(User)
        .createQueryBuilder()
        .delete()
        .where('email LIKE :p OR name LIKE :n', {
          p: `%-${runId}@e2e.test`,
          n: `% ${runId}`,
        })
        .execute();
    }
    await app?.close();
    if (rateLimitBefore === undefined) delete process.env.RATE_LIMIT_ENABLED;
    else process.env.RATE_LIMIT_ENABLED = rateLimitBefore;
  });

  it('signs in with the email (any case) or the phone number', async () => {
    const byEmail = await login(orgA, admin.email!.toUpperCase()).expect(201);
    const byPhone = await login(orgA, `0${phone.slice(4)}`).expect(201);

    for (const res of [byEmail, byPhone]) {
      const { data } = res.body as TokenBody;
      expect(data.refresh_token).toMatch(/^[0-9a-f]{64}$/);
      await me(orgA, data.access_token).expect(200);
    }
  });

  it('me lists the permissions and plan for UI gating', async () => {
    const { data } = (await login(orgA, admin.email!).expect(201))
      .body as TokenBody;
    const body = (await me(orgA, data.access_token).expect(200)).body as {
      data: {
        permissions: string[];
        organization: { status: string };
        plan: { code: string; onTrial: boolean; modules: string[] };
      };
    };
    // A school admin holds every key.
    expect(body.data.permissions).toEqual([...ALL_PERMISSIONS].sort());
    // No plan assigned and no trial: Free.
    expect(body.data.organization.status).toBe(OrganizationStatus.ACTIVE);
    expect(body.data.plan).toMatchObject({ code: 'free', onTrial: false });
    expect(Array.isArray(body.data.plan.modules)).toBe(true);
  });

  it("is not a member of school B, and A's token is refused there", async () => {
    await login(orgB, admin.email!).expect(401);
    const { data } = (await login(orgA, admin.email!).expect(201))
      .body as TokenBody;
    await me(orgB, data.access_token).expect(401);
    await refresh(orgB, data.refresh_token).expect(401);
  });

  it('rotates refresh tokens and ends the sign-in when one is reused', async () => {
    const first = ((await login(orgA, admin.email!)).body as TokenBody).data;

    const second = (
      (await refresh(orgA, first.refresh_token).expect(200)).body as TokenBody
    ).data;
    expect(second.refresh_token).not.toBe(first.refresh_token);
    await me(orgA, second.access_token).expect(200);

    // Replaying the used token revokes the whole family…
    const replay = await refresh(orgA, first.refresh_token).expect(401);
    expect((replay.body as { code: string }).code).toBe('REFRESH_TOKEN_REUSED');
    // …so the newest refresh token and the access tokens stop working too.
    await refresh(orgA, second.refresh_token).expect(401);
    const revoked = await me(orgA, second.access_token).expect(401);
    expect((revoked.body as { code: string }).code).toBe('SESSION_REVOKED');
  });

  it('logout ends the session; the device list shows the others', async () => {
    const keep = ((await login(orgA, admin.email!)).body as TokenBody).data;
    const gone = ((await login(orgA, admin.email!)).body as TokenBody).data;

    await http()
      .post('/api/auth/logout')
      .set('x-tenant-id', orgA.slug)
      .set('Authorization', `Bearer ${gone.access_token}`)
      .expect(200);
    await me(orgA, gone.access_token).expect(401);

    const list = await http()
      .get('/api/auth/sessions')
      .set('x-tenant-id', orgA.slug)
      .set('Authorization', `Bearer ${keep.access_token}`)
      .expect(200);
    const sessions = (list.body as { data: { current: boolean }[] }).data;
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
  });

  it('locks the account for 15 minutes after 5 wrong passwords', async () => {
    const users = rootDs.getRepository(User);
    const victim = await users.save(
      users.create({
        email: `locked-${runId}@e2e.test`,
        name: `Locked ${runId}`,
        password: await bcrypt.hash(PASSWORD, 4),
        status: UserStatus.ACTIVE,
      }),
    );
    await rootDs.getRepository(Membership).save({
      orgId: orgA.id,
      userId: victim.id,
      status: MembershipStatus.ACTIVE,
    });

    for (let i = 0; i < 4; i++) {
      await login(orgA, victim.email!, 'wrong').expect(401);
    }
    const fifth = await login(orgA, victim.email!, 'wrong').expect(401);
    expect((fifth.body as { code: string }).code).toBe('ACCOUNT_LOCKED');

    // Even the right password is refused while locked.
    const locked = await login(orgA, victim.email!).expect(401);
    expect((locked.body as { code: string }).code).toBe('ACCOUNT_LOCKED');

    await users.update(victim.id, { lockedUntil: new Date(Date.now() - 1) });
    await login(orgA, victim.email!).expect(201);
  });

  it('phone-only invite: slip password, forced change, then normal access', async () => {
    const adminToken = ((await login(orgA, admin.email!)).body as TokenBody)
      .data.access_token;
    const invitedPhone = `+88018${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

    const invite = await http()
      .post('/api/users/invite')
      .set('x-tenant-id', orgA.slug)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Guardian ${runId}`, phone: invitedPhone })
      .expect(201);
    const slip = (
      invite.body as {
        data: { delivery: string; temporaryPassword: string };
      }
    ).data;
    expect(slip.delivery).toBe('slip');

    const signedIn = (
      (await login(orgA, invitedPhone, slip.temporaryPassword).expect(201))
        .body as TokenBody
    ).data;
    expect(signedIn.mustChangePassword).toBe(true);

    // Anything but me / change-password / logout is blocked until changed.
    const blocked = await http()
      .get('/api/users')
      .set('x-tenant-id', orgA.slug)
      .set('Authorization', `Bearer ${signedIn.access_token}`)
      .expect(403);
    expect((blocked.body as { code: string }).code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
    const invitedMe = (await me(orgA, signedIn.access_token).expect(200))
      .body as { data: { permissions: string[] } };
    expect(invitedMe.data.permissions).toEqual([]); // no roles yet

    const changed = await http()
      .post('/api/auth/change-password')
      .set('x-tenant-id', orgA.slug)
      .set('Authorization', `Bearer ${signedIn.access_token}`)
      .send({
        currentPassword: slip.temporaryPassword,
        newPassword: 'My-own-pass-9',
      })
      .expect(200);
    const fresh = (changed.body as { data: { access_token: string } }).data
      .access_token;

    // No longer blocked (403 now only means "no users:read permission").
    const after = await http()
      .get('/api/users')
      .set('x-tenant-id', orgA.slug)
      .set('Authorization', `Bearer ${fresh}`);
    expect((after.body as { code?: string }).code).not.toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
    await login(orgA, invitedPhone, 'My-own-pass-9').expect(201);
  });

  it('switches to another school of the account with a one-time code', async () => {
    const tokenA = (
      (await login(orgA, admin.email!).expect(201)).body as TokenBody
    ).data.access_token;
    const schools = () =>
      http()
        .get('/api/auth/schools')
        .set('x-tenant-id', orgA.slug)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
    const switchTo = (orgId: string) =>
      http()
        .post('/api/auth/schools/handoff')
        .set('x-tenant-id', orgA.slug)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ orgId });
    const exchange = (code: string) =>
      http()
        .post('/api/auth/handoff')
        .set('x-tenant-id', orgB.slug)
        .send({ code });

    // Not a member of school B: nothing to switch to, and no code for it.
    expect((await schools()).body).toMatchObject({ data: [] });
    await switchTo(orgB.id).expect(403);
    const same = await switchTo(orgA.id).expect(400);
    expect((same.body as { code: string }).code).toBe('ALREADY_IN_SCHOOL');

    await rootDs.getRepository(Membership).save({
      orgId: orgB.id,
      userId: admin.id,
      role: MembershipRole.MEMBER,
      isAdmin: false,
      status: MembershipStatus.ACTIVE,
    });

    const listed = (await schools()).body as {
      data: { orgId: string; slug: string; host: string; isAdmin: boolean }[];
    };
    expect(listed.data).toEqual([
      expect.objectContaining({
        orgId: orgB.id,
        slug: orgB.slug,
        host: expect.stringContaining(orgB.slug) as unknown,
        isAdmin: false,
      }),
    ]);

    const issued = (await switchTo(orgB.id).expect(200)).body as {
      data: { redirectUrl: string };
    };
    const url = new URL(issued.data.redirectUrl);
    expect(url.hostname.startsWith(`${orgB.slug}.`)).toBe(true);
    expect(url.pathname).toBe('/auth/handoff');
    const code = url.searchParams.get('code')!;

    const signedIn = (await exchange(code).expect(200)).body as TokenBody;
    const onB = (await me(orgB, signedIn.data.access_token).expect(200))
      .body as { data: { organization: { id: string }; isAdmin: boolean } };
    expect(onB.data.organization.id).toBe(orgB.id);
    expect(onB.data.isAdmin).toBe(false);

    // Single use.
    await exchange(code).expect(400);
  });
});
