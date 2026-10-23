import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { In, Like } from 'typeorm';
import { hashPassword } from '~/common/identity/password';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipRole } from '~/modules/memberships/enums/membership-role.enum';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SignupRequest } from '~/modules/signup/entities/signup-request.entity';
import { bootApp, data, error, type E2eApp } from './support/app';

interface Completed {
  orgId: string;
  orgSlug: string;
  code: string;
  redirectUrl: string;
}

/**
 * Self-serve signup (PRD 6.2 and 7.1, backend plan 5.3): a school signs up,
 * verifies by email and lands signed in on its own host; an unverified
 * signup reserves nothing; reserved and taken slugs are refused with
 * suggestions.
 */
describe('Self-serve signup (e2e)', () => {
  let e: E2eApp;
  const runId = randomUUID().slice(0, 8);
  const email = (x: string) => `signup-${x}-${runId}@e2e.test`;
  const slug = (x: string) => `e2e-su-${x}-${runId}`;

  const form = (x: string, overrides: object = {}) => ({
    schoolName: `E2E Signup ${x} ${runId}`,
    type: 'school',
    slug: slug(x),
    ownerName: `Owner ${x}`,
    email: email(x),
    password: 'correct horse battery',
    ...overrides,
  });

  const start = (body: object) =>
    e.http().post('/api/public/signup').send(body);
  const verify = (body: object) =>
    e.http().post('/api/public/signup/verify').send(body);

  /** The token from the last signup email to `to`. */
  const tokenSentTo = (to: string): string => {
    const mails = e.mail.to(to, 'sendSignupVerificationEmail');
    const { link } = mails[mails.length - 1].args[0] as { link: string };
    return new URL(link).searchParams.get('token')!;
  };

  beforeAll(async () => {
    e = await bootApp();
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-su-%-${runId}%`) });
      await e.rootDs
        .getRepository(SignupRequest)
        .delete({ email: Like(`signup-%-${runId}@e2e.test`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`signup-%-${runId}@e2e.test`) });
    }
    await e?.close();
  });

  it('creates the school only after email verification, then signs the owner in on its host', async () => {
    const accepted = await start(form('a')).expect(202);
    expect(data(accepted)).toEqual({
      status: 'verification_sent',
      email: email('a'),
    });

    // Nothing exists yet, and the slug is still free.
    expect(
      await e.rootDs
        .getRepository(Organization)
        .exists({ where: { slug: slug('a') } }),
    ).toBe(false);
    const check = await e
      .http()
      .get(`/api/public/slugs/check?slug=${slug('a')}`)
      .expect(200);
    expect(data(check)).toMatchObject({ available: true });

    const res = await verify({ token: tokenSentTo(email('a')) }).expect(200);
    const done = data<Completed>(res);
    expect(done.orgSlug).toBe(slug('a'));
    const redirect = new URL(done.redirectUrl);
    expect(redirect.hostname).toBe(`${slug('a')}.lvh.me`);
    expect(redirect.pathname).toBe('/auth/handoff');
    expect(redirect.searchParams.get('next')).toBe('/onboarding');
    expect(redirect.searchParams.get('code')).toBe(done.code);

    const org = await e.rootDs.getRepository(Organization).findOneOrFail({
      where: { id: done.orgId },
      relations: { plan: true },
    });
    expect(org.status).toBe(OrganizationStatus.TRIAL);
    expect(org.plan?.code).toBe('free');
    expect(
      Math.round((org.trialEndsAt!.getTime() - Date.now()) / 86_400_000),
    ).toBe(30);

    // The school host redeems the code: the owner is a signed-in admin.
    const session = await e
      .http()
      .post('/api/auth/handoff')
      .set('x-tenant-id', done.orgSlug)
      .send({ code: done.code })
      .expect(200);
    const { access_token, user } = data<{
      access_token: string;
      user: { isAdmin: boolean; email: string };
    }>(session);
    expect(user).toMatchObject({ isAdmin: true, email: email('a') });

    const me = await e
      .http()
      .get('/api/auth/me')
      .set('x-tenant-id', done.orgSlug)
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);
    expect(data(me)).toMatchObject({
      identities: [],
      organization: { slug: done.orgSlug, onboardingCompletedAt: null },
    });
    const owner = await e.rootDs.getRepository(Membership).findOneOrFail({
      where: { orgId: done.orgId },
      relations: { user: true },
    });
    expect(owner).toMatchObject({
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    expect(owner.user.emailVerifiedAt).not.toBeNull();

    // The link works once.
    const reused = await verify({ token: tokenSentTo(email('a')) }).expect(400);
    expect(error(reused)).toMatchObject({ code: 'INVALID_SIGNUP_LINK' });
  });

  it('refuses reserved and taken slugs with suggestions', async () => {
    await start(form('r', { slug: 'admin' })).expect(400);
    await start(form('r', { slug: 'bad_slug' })).expect(400);

    await start(form('t')).expect(202);
    await verify({ token: tokenSentTo(email('t')) }).expect(200);
    const taken = await start(form('t2', { slug: slug('t') })).expect(409);
    expect(error(taken)).toMatchObject({ code: 'SLUG_TAKEN' });
    const suggestions = error(taken).suggestions as string[];
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).not.toContain(slug('t'));
  });

  it('lets the first verified signup take a slug; the other picks a suggestion', async () => {
    await start(form('x1', { slug: slug('race') })).expect(202);
    await start(form('x2', { slug: slug('race') })).expect(202);

    await verify({ token: tokenSentTo(email('x2')) }).expect(200);
    const late = await verify({ token: tokenSentTo(email('x1')) }).expect(409);
    expect(error(late)).toMatchObject({ code: 'SLUG_TAKEN' });

    // The link is still good with another address.
    const res = await verify({
      token: tokenSentTo(email('x1')),
      slug: slug('race2'),
    }).expect(200);
    expect(data<Completed>(res).orgSlug).toBe(slug('race2'));
  });

  it('answers the same for new and existing emails; an active account keeps its password', async () => {
    const users = e.rootDs.getRepository(User);
    await users.save(
      users.create({
        email: email('existing'),
        name: 'Existing',
        password: await hashPassword('their own password'),
        status: UserStatus.ACTIVE,
      }),
    );

    const known = await start(form('existing')).expect(202);
    const unknown = await start(form('fresh')).expect(202);
    expect(Object.keys(data(known))).toEqual(Object.keys(data(unknown)));
    expect(error(known).message).toBe(error(unknown).message);

    const res = await verify({ token: tokenSentTo(email('existing')) }).expect(
      200,
    );
    const account = await users.findOneOrFail({
      where: { email: email('existing') },
      select: { id: true, password: true },
    });
    expect(await bcrypt.compare('their own password', account.password)).toBe(
      true,
    );
    expect(
      await e.rootDs.getRepository(Membership).exists({
        where: {
          orgId: data<Completed>(res).orgId,
          userId: account.id,
          role: MembershipRole.OWNER,
        },
      }),
    ).toBe(true);
  });

  it('takes over a never-verified registration with the signup password', async () => {
    const users = e.rootDs.getRepository(User);
    await users.save(
      users.create({
        email: email('pending'),
        name: 'Squatter',
        password: await hashPassword('squatter password'),
        status: UserStatus.PENDING,
      }),
    );
    await start(form('pending')).expect(202);
    await verify({ token: tokenSentTo(email('pending')) }).expect(200);

    const account = await users.findOneOrFail({
      where: { email: email('pending') },
      select: { id: true, password: true, status: true },
    });
    expect(account.status).toBe(UserStatus.ACTIVE);
    expect(await bcrypt.compare('squatter password', account.password)).toBe(
      false,
    );
    expect(
      await bcrypt.compare('correct horse battery', account.password),
    ).toBe(true);
    // The request no longer holds the password hash.
    const request = await e.rootDs
      .getRepository(SignupRequest)
      .createQueryBuilder('r')
      .addSelect('r.passwordHash')
      .where({ email: email('pending') })
      .getOneOrFail();
    expect(request.passwordHash).toBeNull();
  });

  it('answers 404 to Google sign-in while it is not configured', async () => {
    const res = await e
      .http()
      .get('/api/oauth/google/start?return=lvh.me&intent=signup')
      .expect(404);
    expect(error(res)).toMatchObject({ code: 'GOOGLE_SIGNIN_DISABLED' });
  });

  it('cleans up: only our schools were created', async () => {
    const orgs = await e.rootDs.getRepository(Organization).find({
      where: {
        slug: In(['a', 't', 'race2', 'existing', 'pending'].map(slug)),
      },
    });
    expect(orgs).toHaveLength(5);
  });
});
