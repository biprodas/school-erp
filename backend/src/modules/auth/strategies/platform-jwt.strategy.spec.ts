import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { PlatformJwtStrategy } from './platform-jwt.strategy';

describe('PlatformJwtStrategy', () => {
  const strategy = new PlatformJwtStrategy({
    get: () => 'test-secret',
  } as unknown as ConfigService);

  it('accepts a platform token', () => {
    expect(
      strategy.validate({
        sub: 'user-1',
        email: 'admin@platform.test',
        status: UserStatus.ACTIVE,
        isAdmin: true,
      }),
    ).toEqual({
      userId: 'user-1',
      email: 'admin@platform.test',
      status: UserStatus.ACTIVE,
      isAdmin: true,
    });
  });

  it('rejects a tenant token even when it carries isAdmin', () => {
    expect(() =>
      strategy.validate({
        sub: 'user-1',
        email: 'admin@school.test',
        isAdmin: true,
        orgId: 'org-a',
      }),
    ).toThrow(UnauthorizedException);
  });
});
