import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { hashToken } from '~/common/tokens/secure-token.util';
import { HANDOFF_TTL_MS } from '~/common/tokens/token-ttl.constants';
import { MailService } from '~/shared/mail/mail.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { AccountRepository } from '~/modules/users/repositories/account.repository';
import { MemberRepository } from '~/modules/users/repositories/member.repository';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import { RoleService } from '~/modules/rbac/services/role.service';
import { AuthToken } from '../entities/auth-token.entity';
import { AuthTokenRepository } from '../repositories/auth-token.repository';
import { AuthService } from './auth.service';
import { CredentialService } from './credential.service';
import { SessionService } from './session.service';
import { PlatformAuthService } from './platform-auth.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    email: 'owner@test.com',
    name: 'Owner',
    status: UserStatus.ACTIVE,
    ...overrides,
  }) as User;

const makeMembership = (overrides: Partial<Membership> = {}): Membership =>
  ({
    id: 'mem-1',
    orgId: ORG_ID,
    userId: USER_ID,
    status: MembershipStatus.ACTIVE,
    isAdmin: true,
    ...overrides,
  }) as Membership;

const makeOrg = (overrides: Partial<Organization> = {}): Organization =>
  ({
    id: ORG_ID,
    slug: 'acme',
    status: OrganizationStatus.ACTIVE,
    ...overrides,
  }) as Organization;

describe('PlatformAuthService.issueHandoff', () => {
  let service: PlatformAuthService;
  const userRepo = { findOne: jest.fn() };
  const tokenRepo = {
    create: jest.fn((v: Partial<AuthToken>) => v),
    save: jest.fn((v: Partial<AuthToken>) => Promise.resolve(v)),
  };
  const membershipRepo = { findOne: jest.fn() };
  const organizationRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AuthToken), useValue: tokenRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipRepo },
        {
          provide: getRepositoryToken(Organization),
          useValue: organizationRepo,
        },
        { provide: CredentialService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();
    service = module.get(PlatformAuthService);

    userRepo.findOne.mockResolvedValue(makeUser());
    organizationRepo.findOne.mockResolvedValue(makeOrg());
    membershipRepo.findOne.mockResolvedValue(makeMembership());
  });

  it('stores only the hash of a short-lived code bound to the target org', async () => {
    const before = Date.now();
    const result = await service.issueHandoff(USER_ID, ORG_ID);

    expect(result.orgSlug).toBe('acme');
    expect(result.code).toMatch(/^[0-9a-f]{64}$/);
    const saved = tokenRepo.save.mock.calls[0][0] as AuthToken;
    expect(saved).toMatchObject({
      userId: USER_ID,
      orgId: ORG_ID,
      type: AuthTokenType.HANDOFF,
      tokenHash: hashToken(result.code),
      usedAt: null,
    });
    expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + HANDOFF_TTL_MS,
    );
    expect(saved.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + HANDOFF_TTL_MS,
    );
  });

  it.each([
    ['no membership', () => membershipRepo.findOne.mockResolvedValue(null)],
    [
      'a pending membership',
      () =>
        membershipRepo.findOne.mockResolvedValue(
          makeMembership({ status: MembershipStatus.PENDING }),
        ),
    ],
    [
      'a suspended school',
      () =>
        organizationRepo.findOne.mockResolvedValue(
          makeOrg({ status: OrganizationStatus.SUSPENDED }),
        ),
    ],
    [
      'a missing school',
      () => organizationRepo.findOne.mockResolvedValue(null),
    ],
    [
      'an inactive account',
      () =>
        userRepo.findOne.mockResolvedValue(
          makeUser({ status: UserStatus.SUSPENDED }),
        ),
    ],
  ])('refuses with %s', async (_label, arrange) => {
    arrange();
    await expect(service.issueHandoff(USER_ID, ORG_ID)).rejects.toThrow(
      ForbiddenException,
    );
    expect(tokenRepo.save).not.toHaveBeenCalled();
  });
});

describe('AuthService.exchangeHandoff', () => {
  let service: AuthService;
  const accountRepo = { findById: jest.fn() };
  const memberRepo = { findByUserId: jest.fn() };
  const authTokenRepo = { findByHash: jest.fn(), consume: jest.fn() };
  const roleService = { getUserRoles: jest.fn() };
  const jwtService = { sign: jest.fn(() => 'signed-jwt') };
  const refreshExpiresAt = new Date(Date.now() + 86_400_000);
  const sessions = {
    start: jest.fn().mockResolvedValue({
      sessionId: 'sess-1',
      refreshToken: 'refresh-1',
      refreshExpiresAt,
    }),
  };
  const client = { ip: '203.0.113.7', userAgent: 'jest' };

  const makeRecord = (overrides: Partial<AuthToken> = {}): AuthToken =>
    ({
      id: 'tok-1',
      userId: USER_ID,
      orgId: ORG_ID,
      type: AuthTokenType.HANDOFF,
      expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
      usedAt: null,
      ...overrides,
    }) as AuthToken;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountRepository, useValue: accountRepo },
        { provide: MemberRepository, useValue: memberRepo },
        { provide: RoleService, useValue: roleService },
        { provide: AuthTokenRepository, useValue: authTokenRepo },
        { provide: CredentialService, useValue: {} },
        { provide: SessionService, useValue: sessions },
        { provide: MailService, useValue: {} },
        { provide: JwtService, useValue: jwtService },
        { provide: REQUEST, useValue: { orgId: ORG_ID, orgSlug: 'acme' } },
      ],
    }).compile();
    service = await module.resolve(AuthService);

    authTokenRepo.findByHash.mockResolvedValue(makeRecord());
    authTokenRepo.consume.mockResolvedValue(true);
    accountRepo.findById.mockResolvedValue(makeUser());
    memberRepo.findByUserId.mockResolvedValue(makeMembership());
    roleService.getUserRoles.mockResolvedValue([{ name: 'admin' }]);
  });

  it('consumes the code and returns a tenant session for this org', async () => {
    const result = await service.exchangeHandoff('raw-code', client);

    expect(authTokenRepo.findByHash).toHaveBeenCalledWith(
      hashToken('raw-code'),
      AuthTokenType.HANDOFF,
    );
    expect(authTokenRepo.consume).toHaveBeenCalledWith('tok-1');
    expect(sessions.start).toHaveBeenCalledWith(USER_ID, ORG_ID, client);
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: USER_ID,
      orgId: ORG_ID,
      isAdmin: true,
      sid: 'sess-1',
    });
    expect(result).toMatchObject({
      access_token: 'signed-jwt',
      refresh_token: 'refresh-1',
      refresh_expires_at: refreshExpiresAt,
      user: { id: USER_ID, roles: ['admin'] },
      organization: { id: ORG_ID, slug: 'acme' },
    });
  });

  it('rejects an unknown code (including one issued for another school)', async () => {
    authTokenRepo.findByHash.mockResolvedValue(null);
    await expect(service.exchangeHandoff('raw-code', client)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an expired code', async () => {
    authTokenRepo.findByHash.mockResolvedValue(
      makeRecord({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expect(service.exchangeHandoff('raw-code', client)).rejects.toThrow(
      BadRequestException,
    );
    expect(authTokenRepo.consume).not.toHaveBeenCalled();
  });

  it('rejects a code that was already used', async () => {
    authTokenRepo.findByHash.mockResolvedValue(
      makeRecord({ usedAt: new Date() }),
    );
    await expect(service.exchangeHandoff('raw-code', client)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a code redeemed concurrently by another request', async () => {
    authTokenRepo.consume.mockResolvedValue(false);
    await expect(service.exchangeHandoff('raw-code', client)).rejects.toThrow(
      BadRequestException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
    expect(sessions.start).not.toHaveBeenCalled();
  });

  it('rejects when the membership is no longer active', async () => {
    memberRepo.findByUserId.mockResolvedValue(
      makeMembership({ status: MembershipStatus.SUSPENDED }),
    );
    await expect(service.exchangeHandoff('raw-code', client)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
