import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        isAdmin: true,
        sid: 'sess-1',
      }),
    ).resolves.toEqual({
      userId: 'user-1',
      status: UserStatus.ACTIVE,
      isAdmin: true,
      sessionId: 'sess-1',
      mustChangePassword: false,
    });
  });

  it('rejects a revoked session', async () => {
    sessions.isActive.mockResolvedValue(false);
    await expect(
      strategy.validate({ sub: 'user-1', isAdmin: true, sid: 'sess-1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a tenant token even when it carries isAdmin', async () => {
    await expect(
      strategy.validate({
        sub: 'user-1',
        isAdmin: true,
        sid: 'sess-1',
        orgId: 'org-a',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
