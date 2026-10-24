import { Organization } from '~/modules/organizations/entities/organization.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IdentityService } from './identity.service';
import { EntitlementService } from '~/modules/plans/services/entitlement.service';
import { allowAllEntitlements } from '~/modules/plans/entitlement.testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
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
import { CredentialService } from './credential.service';
import { SessionService } from './session.service';

describe('AuthService activation', () => {
  let service: AuthService;
  let user: User;
  let membership: Membership;
  const accountRepo = { findById: jest.fn(), save: jest.fn() };
  const memberRepo = { findByUserId: jest.fn(), save: jest.fn() };
  const authTokenRepo = { findByHash: jest.fn(), consume: jest.fn() };
  const credentials = { hasOwnPassword: jest.fn(), verify: jest.fn() };
  const sessions = {
    start: jest.fn().mockResolvedValue({
      sessionId: 'sess-1',
      refreshToken: 'r',
      refreshExpiresAt: new Date(),
    }),
    revokeAllForUser: jest.fn(),
  };
  const client = { ip: null, userAgent: null };
  const dto = { token: 'raw-token', password: 'new-password' };

  beforeEach(async () => {
    jest.clearAllMocks();
    user = {
      id: 'user-1',
      email: 'owner@acme.test',
      phone: null,
      password: 'old-hash',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: null,
      mustChangePassword: false,
    } as User;
    membership = {
      orgId: 'org-1',
      userId: 'user-1',
      status: MembershipStatus.PENDING,
      isAdmin: true,
    } as Membership;
    accountRepo.findById.mockResolvedValue(user);
    memberRepo.findByUserId.mockResolvedValue(membership);
    authTokenRepo.findByHash.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      type: AuthTokenType.ACTIVATION,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    authTokenRepo.consume.mockResolvedValue(true);
    credentials.hasOwnPassword.mockResolvedValue(false);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountRepository, useValue: accountRepo },
        { provide: MemberRepository, useValue: memberRepo },
        {
          provide: RoleService,
          useValue: { getUserRoles: () => Promise.resolve([]) },
        },
        { provide: AuthTokenRepository, useValue: authTokenRepo },
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
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: REQUEST, useValue: { orgId: 'org-1', orgSlug: 'acme' } },
      ],
    }).compile();
    service = await module.resolve(AuthService);
  });

  it('sets the password of a new account and ends its other sessions', async () => {
    await service.activate(dto, client);

    expect(user.password).not.toBe('old-hash');
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(accountRepo.save).toHaveBeenCalledWith(user);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(membership.status).toBe(MembershipStatus.ACTIVE);
    expect(authTokenRepo.consume).toHaveBeenCalledWith('tok-1');
  });

  it('keeps the password of an account that has its own, after checking it', async () => {
    credentials.hasOwnPassword.mockResolvedValue(true);
    credentials.verify.mockResolvedValue(user);

    await service.activate(dto, client);

    expect(credentials.verify).toHaveBeenCalledWith(
      'owner@acme.test',
      'new-password',
      expect.any(Function),
    );
    expect(user.password).toBe('old-hash');
    expect(accountRepo.save).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    expect(membership.status).toBe(MembershipStatus.ACTIVE);
  });

  it('refuses a wrong password for such an account and keeps the link', async () => {
    credentials.hasOwnPassword.mockResolvedValue(true);
    credentials.verify.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );

    await expect(service.activate(dto, client)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authTokenRepo.consume).not.toHaveBeenCalled();
    expect(membership.status).toBe(MembershipStatus.PENDING);
  });

  it('does not reactivate a suspended membership', async () => {
    membership.status = MembershipStatus.SUSPENDED;

    await expect(service.activate(dto, client)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authTokenRepo.consume).not.toHaveBeenCalled();
    expect(memberRepo.save).not.toHaveBeenCalled();
  });

  it('uses a link only once, even when two requests race', async () => {
    authTokenRepo.consume.mockResolvedValue(false);

    await expect(service.activate(dto, client)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(accountRepo.save).not.toHaveBeenCalled();
  });

  it('refuses a school sign-in for a registered but unverified account', async () => {
    user.status = UserStatus.PENDING;
    membership.status = MembershipStatus.ACTIVE;
    credentials.verify.mockResolvedValue(user);

    await expect(
      service.login({ identifier: 'owner@acme.test', password: 'pw' }, client),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCOUNT_PENDING' }) as unknown,
    });
    expect(sessions.start).not.toHaveBeenCalled();
  });
});
