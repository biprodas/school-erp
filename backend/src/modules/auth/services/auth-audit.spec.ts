import { Organization } from '~/modules/organizations/entities/organization.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IdentityService } from './identity.service';
import { EntitlementService } from '~/modules/plans/services/entitlement.service';
import { allowAllEntitlements } from '~/modules/plans/entitlement.testing';
import { UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { MailService } from '~/shared/mail/mail.service';
import { AuditService } from '~/modules/audit/services/audit.service';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { RoleService } from '~/modules/rbac/services/role.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { AccountRepository } from '~/modules/users/repositories/account.repository';
import { MemberRepository } from '~/modules/users/repositories/member.repository';
import { AuthTokenRepository } from '../repositories/auth-token.repository';
import { AuthService } from './auth.service';
import {
  AccountLockedException,
  CredentialService,
  FailedSignIn,
} from './credential.service';
import { SessionService } from './session.service';

/** `expect.objectContaining` typed, for nesting inside matcher objects. */
const like = (shape: object): unknown =>
  expect.objectContaining(shape) as unknown;

const USER_ID = 'user-1';

describe('AuthService sign-in auditing', () => {
  let service: AuthService;
  const audit = { record: jest.fn() };
  const memberRepo = { findByUserId: jest.fn() };
  const credentials = { verify: jest.fn() };
  const sessions = {
    start: jest.fn().mockResolvedValue({
      sessionId: 'sess-1',
      refreshToken: 'r',
      refreshExpiresAt: new Date(),
    }),
  };
  const client = { ip: null, userAgent: null };
  const dto = { identifier: 'teacher@acme.test', password: 'pw' };

  const user = { id: USER_ID, status: UserStatus.ACTIVE } as User;
  const member = (status = MembershipStatus.ACTIVE) =>
    ({ orgId: 'org-1', userId: USER_ID, status, isAdmin: false }) as Membership;

  /** `verify` reports `failure`, then throws like the real one. */
  const failWith = (failure: FailedSignIn) =>
    credentials.verify.mockImplementation(
      async (
        _id: string,
        _pw: string,
        onFailure: (f: FailedSignIn) => Promise<void>,
      ) => {
        await onFailure(failure);
        throw failure.locked
          ? new AccountLockedException(new Date())
          : new UnauthorizedException('Invalid credentials');
      },
    );

  const recorded = () =>
    audit.record.mock.calls.map(([entry]: [Record<string, unknown>]) => entry);

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountRepository, useValue: {} },
        { provide: MemberRepository, useValue: memberRepo },
        {
          provide: RoleService,
          useValue: { getUserRoles: () => Promise.resolve([]) },
        },
        { provide: AuthTokenRepository, useValue: {} },
        { provide: CredentialService, useValue: credentials },
        { provide: SessionService, useValue: sessions },
        { provide: MailService, useValue: {} },
        { provide: JwtService, useValue: { sign: () => 'jwt' } },
        {
          provide: IdentityService,
          useValue: { list: () => Promise.resolve([]) },
        },
        { provide: EntitlementService, useValue: allowAllEntitlements() },
        {
          provide: getRepositoryToken(Organization),
          useValue: { findOne: () => Promise.resolve(null) },
        },
        { provide: AuditService, useValue: audit },
        { provide: REQUEST, useValue: { orgId: 'org-1', orgSlug: 'acme' } },
      ],
    }).compile();
    service = await module.resolve(AuthService);
  });

  it('records a successful sign-in on its session', async () => {
    credentials.verify.mockResolvedValue(user);
    memberRepo.findByUserId.mockResolvedValue(member());

    await service.login(dto, client);

    expect(recorded()).toEqual([
      like({
        action: 'auth.login',
        actorUserId: USER_ID,
        entityType: 'session',
        entityId: 'sess-1',
        after: { method: 'password' },
      }),
    ]);
  });

  it("records a member's wrong password and the lock it causes", async () => {
    failWith({ userId: USER_ID, locked: true });
    memberRepo.findByUserId.mockResolvedValue(member());

    await expect(service.login(dto, client)).rejects.toThrow(
      AccountLockedException,
    );

    expect(recorded()).toEqual([
      like({
        action: 'auth.login_failed',
        actorUserId: USER_ID,
        after: like({
          reason: 'wrong_password',
          locked: true,
          identifier: 'teacher@acme.test',
        }),
      }),
      like({
        action: 'auth.account_locked',
        entityType: 'user',
        entityId: USER_ID,
      }),
    ]);
  });

  it("keeps another school's account anonymous, without its lock", async () => {
    failWith({ userId: 'outsider', locked: true });
    memberRepo.findByUserId.mockResolvedValue(null);

    await expect(service.login(dto, client)).rejects.toThrow();

    expect(recorded()).toEqual([
      like({
        action: 'auth.login_failed',
        actorUserId: null,
        after: like({ reason: 'unknown_account' }),
      }),
    ]);
    expect(JSON.stringify(recorded())).not.toContain('outsider');
  });

  it('records an unknown account anonymously', async () => {
    failWith({ userId: null, locked: false });

    await expect(service.login(dto, client)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(recorded()).toEqual([
      like({
        actorUserId: null,
        after: like({ reason: 'unknown_account' }),
      }),
    ]);
  });

  it('records a refused membership with its reason', async () => {
    credentials.verify.mockResolvedValue(user);
    memberRepo.findByUserId.mockResolvedValue(
      member(MembershipStatus.SUSPENDED),
    );

    await expect(service.login(dto, client)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(recorded()).toEqual([
      like({
        action: 'auth.login_failed',
        actorUserId: USER_ID,
        after: like({ reason: 'membership_suspended' }),
      }),
    ]);
    expect(sessions.start).not.toHaveBeenCalled();
  });

  it('never stores the password', async () => {
    failWith({ userId: USER_ID, locked: false });
    memberRepo.findByUserId.mockResolvedValue(member());

    await expect(service.login(dto, client)).rejects.toThrow();

    expect(JSON.stringify(recorded())).not.toContain('"pw"');
  });
});
