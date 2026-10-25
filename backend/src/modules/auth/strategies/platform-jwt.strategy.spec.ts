import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole } from '~/modules/users/enums/platform-role.enum';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import type { SessionService } from '../services/session.service';
import { PlatformJwtStrategy } from './platform-jwt.strategy';

describe('PlatformJwtStrategy', () => {
  const sessions = { isActive: jest.fn() };
  const strategy = new PlatformJwtStrategy(
    { get: () => 'test-secret' } as unknown as ConfigService,
    sessions as unknown as SessionService,
  );

  beforeEach(() => sessions.isActive.mockReset().mockResolvedValue(true));

  it('accepts a platform token with an active session', async () => {
    await expect(
      strategy.validate({
        sub: 'user-1',
        status: UserStatus.ACTIVE,
        role: PlatformRole.SUPPORT,
        sid: 'sess-1',
      }),
    ).resolves.toEqual({
      userId: 'user-1',
      status: UserStatus.ACTIVE,
      isAdmin: false,
      platformRole: PlatformRole.SUPPORT,
      sessionId: 'sess-1',
      mustChangePassword: false,
    });
  });

  it('reads a token without a role (issued before roles) as no role', async () => {
    await expect(
      strategy.validate({ sub: 'user-1', sid: 'sess-1' }),
    ).resolves.toMatchObject({ platformRole: PlatformRole.USER });
    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: 'sess-1',
        role: 'root' as PlatformRole,
      }),
    ).resolves.toMatchObject({ platformRole: PlatformRole.USER });
  });

  it('rejects a revoked session', async () => {
    sessions.isActive.mockResolvedValue(false);
    await expect(
      strategy.validate({
        sub: 'user-1',
        role: PlatformRole.SUPER_ADMIN,
        sid: 'sess-1',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a tenant token even when it carries a role', async () => {
    await expect(
      strategy.validate({
        sub: 'user-1',
        role: PlatformRole.SUPER_ADMIN,
        sid: 'sess-1',
        orgId: 'org-a',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
