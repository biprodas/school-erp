import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestWithOrg } from '~/tenancy/tenant.middleware';
import type { SessionService } from '../services/session.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const sessions = { isActive: jest.fn() };
  const strategy = new JwtStrategy(
    { get: () => 'test-secret' } as unknown as ConfigService,
    sessions as unknown as SessionService,
  );

  const payload = {
    sub: 'user-1',
    orgId: 'org-a',
    isAdmin: true,
    sid: 'sess-1',
  };

  const reqFor = (orgId?: string) => ({ orgId }) as RequestWithOrg;

  beforeEach(() => sessions.isActive.mockReset().mockResolvedValue(true));

  it('accepts a token issued by the resolved organization with an active session', async () => {
    await expect(strategy.validate(reqFor('org-a'), payload)).resolves.toEqual({
      userId: 'user-1',
      orgId: 'org-a',
      isAdmin: true,
      sessionId: 'sess-1',
      mustChangePassword: false,
    });
    expect(sessions.isActive).toHaveBeenCalledWith('sess-1');
  });

  it('carries the forced password change flag', async () => {
    await expect(
      strategy.validate(reqFor('org-a'), { ...payload, mcp: true }),
    ).resolves.toMatchObject({ mustChangePassword: true });
  });

  it('rejects a token whose session was revoked', async () => {
    sessions.isActive.mockResolvedValue(false);
    await expect(strategy.validate(reqFor('org-a'), payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token without a session id', async () => {
    await expect(
      strategy.validate(reqFor('org-a'), { ...payload, sid: undefined }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.isActive).not.toHaveBeenCalled();
  });

  it('rejects a token issued by a different organization [tenant-isolation]', async () => {
    await expect(strategy.validate(reqFor('org-b'), payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token without an orgId (e.g. a platform token)', async () => {
    await expect(
      strategy.validate(reqFor('org-a'), { ...payload, orgId: undefined }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the request has no resolved organization', async () => {
    await expect(strategy.validate(reqFor(undefined), payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
