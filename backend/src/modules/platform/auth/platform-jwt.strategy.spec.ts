import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        status: 'active',
        isAdmin: true,
      }),
    ).toEqual({
      userId: 'user-1',
      email: 'admin@platform.test',
      status: 'active',
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
