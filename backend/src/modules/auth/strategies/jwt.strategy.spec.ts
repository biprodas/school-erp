import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const strategy = new JwtStrategy({
    get: () => 'test-secret',
  } as unknown as ConfigService);

  const payload = {
    sub: 'user-1',
    email: 'a@school.test',
    orgId: 'org-a',
    isAdmin: true,
  };

  const reqFor = (orgId?: string) => ({ orgId }) as RequestWithOrg;

  it('accepts a token issued by the resolved organization', () => {
    expect(strategy.validate(reqFor('org-a'), payload)).toEqual({
      userId: 'user-1',
      email: 'a@school.test',
      orgId: 'org-a',
      isAdmin: true,
    });
  });

  it('rejects a token issued by a different organization', () => {
    expect(() => strategy.validate(reqFor('org-b'), payload)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token without an orgId (e.g. a platform token)', () => {
    const platformLike = { ...payload, orgId: undefined };
    expect(() => strategy.validate(reqFor('org-a'), platformLike)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the request has no resolved organization', () => {
    expect(() => strategy.validate(reqFor(undefined), payload)).toThrow(
      UnauthorizedException,
    );
  });
});
