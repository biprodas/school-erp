import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '~/shared/mail/mail.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { PlatformAuditService } from '~/modules/audit/services/platform-audit.service';
import { AuthToken } from '../entities/auth-token.entity';
import { CredentialService } from './credential.service';
import { SessionService } from './session.service';
import { PlatformAuthService } from './platform-auth.service';

describe('PlatformAuthService.verifyEmail auditing', () => {
  let service: PlatformAuthService;
  let user: Partial<User>;
  let audit: { record: jest.Mock };

  beforeEach(() => {
    user = { id: 'user-1', email: 'a@test.com', status: UserStatus.PENDING };
    audit = { record: jest.fn() };
    const userRepo = {
      findOne: jest.fn(() => Promise.resolve(user)),
      save: jest.fn((v: unknown) => Promise.resolve(v)),
    };
    const tokenRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({
          userId: 'user-1',
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ),
      save: jest.fn((v: unknown) => Promise.resolve(v)),
    };
    const sessions = {
      start: jest.fn(() =>
        Promise.resolve({
          sessionId: 'sess-1',
          refreshToken: 'r',
          refreshExpiresAt: new Date(),
        }),
      ),
    };
    service = new PlatformAuthService(
      userRepo as unknown as Repository<User>,
      tokenRepo as unknown as Repository<AuthToken>,
      {} as Repository<Membership>,
      {} as Repository<Organization>,
      {} as CredentialService,
      sessions as unknown as SessionService,
      {} as MailService,
      { sign: () => 'jwt' } as unknown as JwtService,
      audit as unknown as PlatformAuditService,
    );
  });

  const actions = () =>
    audit.record.mock.calls.map(([e]: [{ action: string }]) => e.action);

  it('records the activation of a pending account, then the sign-in', async () => {
    await service.verifyEmail('raw', { ip: null, userAgent: null });

    expect(actions()).toEqual([
      AUDIT_ACTIONS.ACCOUNT_ACTIVATED,
      AUDIT_ACTIONS.LOGIN,
    ]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.ACCOUNT_ACTIVATED,
        entityType: 'user',
        entityId: 'user-1',
        actorUserId: 'user-1',
      }),
    );
  });

  it('records only the sign-in when the account was already active', async () => {
    user.status = UserStatus.ACTIVE;

    await service.verifyEmail('raw', { ip: null, userAgent: null });

    expect(actions()).toEqual([AUDIT_ACTIONS.LOGIN]);
  });
});
