import { randomUUID } from 'crypto';
import { Like } from 'typeorm';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { OrganizationDomain } from '~/modules/organizations/entities/organization-domain.entity';
import { DomainStatus } from '~/modules/organizations/enums/domain-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { UserIdentity } from '~/modules/auth/entities/user-identity.entity';
import { SessionService } from '~/modules/auth/services/session.service';
import { GOOGLE_FETCH } from '~/modules/oauth/google-oidc.client';
import {
  FakeGoogle,
  type FakeGoogleUser,
} from '~/modules/oauth/google.testing';
import { bootApp, data, error, type E2eApp } from './support/app';

/**
 * Google sign-in (PRD 6.3, doc/domains-and-routing.md 5a, backend plan 5.5)
 * against a stubbed Google: start → Google → callback → handoff → session,
 * from a subdomain and a custom domain; non-members get the same answer as
 * unknown accounts; states are single use; no open redirects.
 */
describe('Google sign-in (e2e)', () => {
  let e: E2eApp;
  const google = new FakeGoogle('e2e-google-client');
  const runId = randomUUID().slice(0, 8);
  const email = (x: string) => `google-${x}-${runId}@e2e.test`;
  let org: Organization;
  let member: User;
  let outsider: User;
  const customHost = `erp-${runId}.e2e-school.test`;
  const schoolHost = () => `${org.slug}.lvh.me`;

  /** Follows start → Google consent; returns the callback's redirect. */
  const signIn = async (
    query: Record<string, string>,
    user: FakeGoogleUser,
  ): Promise<URL> => {
    const started = await e
      .http()
      .get('/api/oauth/google/start')
      .query(query)
      .expect(302);
    const authorize = new URL(started.headers.location);
    expect(authorize.host).toBe('accounts.google.com');
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    return callback(google.authorize(authorize.toString(), user));
  };

  const callback = async (query: { state: string; code: string }) => {
    const res = await e
      .http()
      .get('/api/oauth/google/callback')
      .query(query)
      .expect(302);
    return new URL(res.headers.location);
  };

  const redeem = (slug: string, code: string) =>
    e.http().post('/api/auth/handoff').set('x-tenant-id', slug).send({ code });

  beforeAll(async () => {
    e = await bootApp(
      (b) => b.overrideProvider(GOOGLE_FETCH).useValue(google.fetch),
      {
        GOOGLE_CLIENT_ID: google.clientId,
        GOOGLE_CLIENT_SECRET: 'e2e-secret',
      },
    );
    org = await e.rootDs.getRepository(Organization).save({
      name: `E2E Google ${runId}`,
      slug: `e2e-google-${runId}`,
      status: OrganizationStatus.ACTIVE,
    });
    await e.rootDs.getRepository(OrganizationDomain).save({
      orgId: org.id,
      hostname: customHost,
      isPrimary: true,
      status: DomainStatus.VERIFIED,
      verificationToken: `tok-${runId}`,
    });
    const users = e.rootDs.getRepository(User);
    [member, outsider] = await users.save(
      ['member', 'outsider'].map((x) =>
        users.create({
          email: email(x),
          name: x,
          password: 'not-used',
          status: UserStatus.ACTIVE,
        }),
      ),
    );
    await e.rootDs.getRepository(Membership).save({
      orgId: org.id,
      userId: member.id,
      role: MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-google%${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`google-%-${runId}@e2e.test`) });
    }
    await e?.close();
  });

  it('signs a member in from the school subdomain, linking Google by verified email', async () => {
    const back = await signIn(
      { return: schoolHost(), next: '/students?class=6' },
      { sub: `g-member-${runId}`, email: email('member') },
    );
    expect(back.host).toBe(`${schoolHost()}:3000`);
    expect(back.pathname).toBe('/auth/handoff');
    expect(back.searchParams.get('next')).toBe('/students?class=6');

    const session = await redeem(
      org.slug,
      back.searchParams.get('code')!,
    ).expect(200);
    expect(data<{ user: { id: string } }>(session).user.id).toBe(member.id);

    const identity = await e.rootDs.getRepository(UserIdentity).findOneOrFail({
      where: { userId: member.id },
    });
    expect(identity).toMatchObject({
      provider: 'google',
      subject: `g-member-${runId}`,
    });
  });

  it('signs in from the custom domain and returns there', async () => {
    const back = await signIn(
      { return: customHost },
      { sub: `g-member-${runId}`, email: email('member') },
    );
    expect(back.hostname).toBe(customHost);
    expect(back.searchParams.get('next')).toBe('/dashboard');
    await redeem(org.slug, back.searchParams.get('code')!).expect(200);
  });

  it('gives a non-member the same answer as an unknown account', async () => {
    const outsiderBack = await signIn(
      { return: schoolHost() },
      { sub: `g-outsider-${runId}`, email: email('outsider') },
    );
    const unknownBack = await signIn(
      { return: schoolHost() },
      { sub: `g-unknown-${runId}`, email: email('unknown') },
    );
    for (const back of [outsiderBack, unknownBack]) {
      expect(back.hostname).toBe(schoolHost());
      expect(back.pathname).toBe('/login');
      expect(back.searchParams.get('error')).toBe('google_no_account');
    }
  });

  it('refuses an unverified Google email', async () => {
    const back = await signIn(
      { return: schoolHost() },
      {
        sub: `g-unverified-${runId}`,
        email: email('member'),
        emailVerified: false,
      },
    );
    expect(back.searchParams.get('error')).toBe('google_email_unverified');
  });

  it('uses each state once', async () => {
    const started = await e
      .http()
      .get('/api/oauth/google/start')
      .query({ return: schoolHost() })
      .expect(302);
    const grant = google.authorize(started.headers.location, {
      sub: `g-member-${runId}`,
      email: email('member'),
    });
    await callback(grant);
    const replay = await callback(grant);
    expect(replay.hostname).toBe('lvh.me');
    expect(replay.searchParams.get('error')).toBe('google_expired');
  });

  it('never redirects off our hosts', async () => {
    for (const host of [
      'evil.example.com',
      'lvh.me.evil.example.com',
      `unknown-${runId}.lvh.me`,
      'https://evil.example.com',
    ]) {
      const res = await e
        .http()
        .get('/api/oauth/google/start')
        .query({ return: host })
        .expect(400);
      expect(error(res)).toMatchObject({ code: 'INVALID_RETURN_HOST' });
    }
    const back = await signIn(
      { return: schoolHost(), next: '//evil.example.com/x' },
      { sub: `g-member-${runId}`, email: email('member') },
    );
    expect(back.hostname).toBe(schoolHost());
    expect(back.searchParams.get('next')).toBe('/dashboard');
  });

  it('signs in to the platform from the admin host', async () => {
    const back = await signIn(
      { return: 'admin.lvh.me' },
      { sub: `g-member-${runId}`, email: email('member') },
    );
    expect(back.hostname).toBe('admin.lvh.me');
    const res = await e
      .http()
      .post('/api/platform/auth/handoff/exchange')
      .send({ code: back.searchParams.get('code') })
      .expect(200);
    expect(data<{ user: { id: string } }>(res).user.id).toBe(member.id);
    // School codes don't work there, and the platform code works once.
    await e
      .http()
      .post('/api/platform/auth/handoff/exchange')
      .send({ code: back.searchParams.get('code') })
      .expect(400);
  });

  it('links and unlinks from account settings; unlinking needs a password', async () => {
    const { sessionId } = await e.app
      .get(SessionService)
      .start(outsider.id, null);
    const token = e.jwt.sign({
      sub: outsider.id,
      status: UserStatus.ACTIVE,
      isAdmin: false,
      sid: sessionId,
    });
    const linkStart = await e
      .http()
      .post('/api/platform/auth/identities/google/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ returnHost: 'admin.lvh.me', next: '/account' })
      .expect(200);
    const grant = google.authorize(data<{ url: string }>(linkStart).url, {
      sub: `g-outsider-${runId}`,
      email: email('outsider-gmail'),
    });
    const back = await callback(grant);
    expect(back.pathname).toBe('/account');
    expect(back.searchParams.get('google')).toBe('linked');

    // Another account can't take the same Google identity.
    const stolen = google.authorize(
      data<{ url: string }>(
        await e
          .http()
          .post('/api/platform/auth/identities/google/link')
          .set('Authorization', `Bearer ${await e.platformToken(member.id)}`)
          .send({ returnHost: 'admin.lvh.me', next: '/account' })
          .expect(200),
      ).url,
      { sub: `g-outsider-${runId}`, email: email('outsider-gmail') },
    );
    // member already has its own Google identity from the first test.
    expect((await callback(stolen)).searchParams.get('google_error')).toMatch(
      /^google_(in_use|already_linked)$/,
    );

    const users = e.rootDs.getRepository(User);
    await users.update(outsider.id, { passwordSet: false });
    const refused = await e
      .http()
      .delete('/api/platform/auth/identities/google')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(error(refused)).toMatchObject({ code: 'PASSWORD_REQUIRED' });

    await users.update(outsider.id, { passwordSet: true });
    await e
      .http()
      .delete('/api/platform/auth/identities/google')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      await e.rootDs
        .getRepository(UserIdentity)
        .exists({ where: { userId: outsider.id } }),
    ).toBe(false);
  });

  it('verifies the owner email at signup in place of the emailed link', async () => {
    const back = await signIn(
      { return: 'lvh.me', intent: 'signup' },
      { sub: `g-founder-${runId}`, email: email('founder') },
    );
    expect(back.pathname).toBe('/signup');
    const ticket = back.searchParams.get('google_ticket')!;

    const res = await e
      .http()
      .post('/api/public/signup')
      .send({
        schoolName: `E2E Google School ${runId}`,
        type: 'school',
        slug: `e2e-google-new-${runId}`,
        ownerName: 'Founder',
        email: email('founder'),
        googleTicket: ticket,
      })
      .expect(202);
    const created = data<{ status: string; orgSlug: string; code: string }>(
      res,
    );
    expect(created.status).toBe('created');
    await redeem(created.orgSlug, created.code).expect(200);

    const founder = await e.rootDs.getRepository(User).findOneOrFail({
      where: { email: email('founder') },
    });
    expect(founder.passwordSet).toBe(false);
    expect(
      await e.rootDs.getRepository(UserIdentity).exists({
        where: { userId: founder.id, subject: `g-founder-${runId}` },
      }),
    ).toBe(true);

    // A ticket for another email doesn't verify this one.
    const mismatch = await e
      .http()
      .post('/api/public/signup')
      .send({
        schoolName: 'Mismatch',
        type: 'school',
        slug: `e2e-google-mm-${runId}`,
        ownerName: 'Someone Else',
        email: email('someone-else'),
        googleTicket: ticket,
      })
      .expect(400);
    expect(error(mismatch)).toMatchObject({ code: 'GOOGLE_EMAIL_MISMATCH' });
  });
});
