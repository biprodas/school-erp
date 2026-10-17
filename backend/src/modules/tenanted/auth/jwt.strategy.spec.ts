import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestWithTenant } from '~/tenancy/tenant.middleware';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const strategy = new JwtStrategy({
    get: () => 'test-secret',
  } as unknown as ConfigService);

  const payload = {
    sub: 'user-1',
    email: 'a@school.test',
    tenantId: 'tenant-a',
    schemaName: 'tenant_a',
    isAdmin: true,
  };

  const reqFor = (tenantId?: string) => ({ tenantId }) as RequestWithTenant;

  it('accepts a token issued by the resolved tenant', () => {
    expect(strategy.validate(reqFor('tenant-a'), payload)).toEqual({
      userId: 'user-1',
      email: 'a@school.test',
      tenantId: 'tenant-a',
      schemaName: 'tenant_a',
      isAdmin: true,
    });
  });

  it('rejects a token issued by a different tenant', () => {
    expect(() => strategy.validate(reqFor('tenant-b'), payload)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token without a tenantId (e.g. a platform token)', () => {
    const platformLike = { ...payload, tenantId: undefined };
    expect(() => strategy.validate(reqFor('tenant-a'), platformLike)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the request has no resolved tenant', () => {
    expect(() => strategy.validate(reqFor(undefined), payload)).toThrow(
      UnauthorizedException,
    );
  });
});
