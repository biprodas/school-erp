import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
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
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';

/**
 * Cross-host sign-in: the platform issues a one-time code for one school
 * (`POST /platform/auth/handoff`), and only that school redeems it, once
 * (`POST /auth/handoff`).
 */
describe('Sign-in handoff (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let jwt: JwtService;

  const runId = randomUUID().slice(0, 8);
  let orgA: Organization;
  let orgB: Organization;
  let user: User;
  let platformSessionId: string;

  const platformToken = () =>
    jwt.sign({
      sub: user.id,
      status: UserStatus.ACTIVE,
      isAdmin: false,
      sid: platformSessionId,
    });

  const issue = (orgId: string) =>
    request(app.getHttpServer())
      .post('/api/platform/auth/handoff')
      .set('Authorization', `Bearer ${platformToken()}`)
      .send({ orgId });

  const exchange = (org: Organization, code: string) =>
    request(app.getHttpServer())
      .post('/api/auth/handoff')
      .set('x-tenant-id', org.slug)
      .send({ code });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rootDs = app.get<DataSource>(getDataSourceToken());
    jwt = new JwtService({ secret: process.env.JWT_SECRET });

    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save(
      ['a', 'b'].map((x) =>
        orgs.create({
          name: `E2E Handoff ${x.toUpperCase()} ${runId}`,
          slug: `e2e-handoff-${x}-${runId}`,
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );

    const users = rootDs.getRepository(User);
    user = await users.save(
      users.create({
        email: `handoff-${runId}@e2e.test`,
        name: 'Handoff Owner',
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );

    ({ sessionId: platformSessionId } = await app
      .get(SessionService)
      .start(user.id, null));

    // A member of school A only.
    const memberships = rootDs.getRepository(Membership);
    await memberships.save(
      memberships.create({
        orgId: orgA.id,
        userId: user.id,
        role: MembershipRole.OWNER,
        isAdmin: true,
        status: MembershipStatus.ACTIVE,
      }),
    );
  });

  afterAll(async () => {
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) {
        await rootDs.getRepository(Organization).delete(ids);
      }
      if (user?.id) {
        await rootDs.getRepository(User).delete(user.id);
      }
    }
    await app?.close();
  });

  it('signs a member in to their school, once, and only there', async () => {
    const issued = await issue(orgA.id).expect(200);
    const { code, orgSlug } = (
      issued.body as { data: { code: string; orgSlug: string } }
    ).data;
    expect(orgSlug).toBe(orgA.slug);

    // Another school can't redeem it (and trying doesn't burn it).
    await exchange(orgB, code).expect(400);

    const res = await exchange(orgA, code).expect(200);
    const { access_token, organization } = (
      res.body as {
        data: { access_token: string; organization: { id: string } };
      }
    ).data;
    expect(organization.id).toBe(orgA.id);
    expect(
      jwt.decode<{ orgId: string; sub: string }>(access_token),
    ).toMatchObject({
      orgId: orgA.id,
      sub: user.id,
    });

    // Single use.
    await exchange(orgA, code).expect(400);
  });

  it('refuses to issue a code for a school the user does not belong to', async () => {
    await issue(orgB.id).expect(403);
  });

  it('requires a platform session to issue a code', async () => {
    await request(app.getHttpServer())
      .post('/api/platform/auth/handoff')
      .send({ orgId: orgA.id })
      .expect(401);
  });
});
