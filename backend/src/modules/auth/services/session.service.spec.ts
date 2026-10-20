import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { hashToken } from '~/common/tokens/secure-token.util';
import type { UserSession } from '../entities/user-session.entity';
import { SessionService } from './session.service';
import type { OrgSettingsReader } from '~/modules/settings/services/org-settings.reader';

const DAY = 86_400_000;

describe('SessionService', () => {
  let repo: {
    insert: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    exists: jest.Mock;
    find: jest.Mock;
  };
  let service: SessionService;
  let idleMinutes: number | null;

  const row = (overrides: Partial<UserSession> = {}) => ({
    id: 'row-1',
    userId: 'user-1',
    orgId: 'org-a',
    familyId: 'fam-1',
    refreshHash: 'h',
    ip: '203.0.113.7',
    userAgent: 'phone',
    createdAt: new Date(Date.now() - DAY),
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + DAY),
    revokedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    repo = {
      insert: jest.fn(),
      findOne: jest.fn().mockResolvedValue(row()),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      exists: jest.fn().mockResolvedValue(true),
      find: jest.fn().mockResolvedValue([]),
    };
    idleMinutes = null;
    service = new SessionService(
      repo as unknown as Repository<UserSession>,
      { get: () => ({ refreshTtlMs: 30 * DAY }) } as unknown as ConfigService,
      {
        get: () =>
          Promise.resolve({ security: { sessionIdleMinutes: idleMinutes } }),
      } as unknown as OrgSettingsReader,
    );
  });

  it('starts a family and stores only the hash of the refresh token', async () => {
    const issued = await service.start('user-1', 'org-a', {
      ip: '203.0.113.7',
      userAgent: 'phone',
    });

    const [[inserted]] = repo.insert.mock.calls as [[UserSession]];
    expect(inserted).toMatchObject({
      userId: 'user-1',
      orgId: 'org-a',
      familyId: issued.sessionId,
      refreshHash: hashToken(issued.refreshToken),
      ip: '203.0.113.7',
      userAgent: 'phone',
    });
    expect(inserted.refreshHash).not.toBe(issued.refreshToken);
    expect(issued.refreshExpiresAt.getTime()).toBeGreaterThan(
      Date.now() + 29 * DAY,
    );
  });

  it('rotates: revokes the used token and issues the next one in the same family', async () => {
    const rotated = await service.rotate('raw-refresh', 'org-a');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { refreshHash: hashToken('raw-refresh') },
    });
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-1' }),
      { revokedAt: expect.any(Date) as Date },
    );
    expect(rotated).toMatchObject({ userId: 'user-1', sessionId: 'fam-1' });
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 'fam-1',
        refreshHash: hashToken(rotated.refreshToken),
      }),
    );
  });

  it('revokes the whole family when a used token is presented again', async () => {
    repo.findOne.mockResolvedValue(row({ revokedAt: new Date() }));

    await expect(service.rotate('raw-refresh', 'org-a')).rejects.toMatchObject({
      response: { code: 'REFRESH_TOKEN_REUSED' },
    });
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'fam-1' }),
      { revokedAt: expect.any(Date) as Date },
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('treats losing a concurrent refresh as reuse', async () => {
    repo.update.mockResolvedValueOnce({ affected: 0 });

    await expect(service.rotate('raw-refresh', 'org-a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("refuses another school's (or the platform's) refresh token", async () => {
    await expect(service.rotate('raw-refresh', 'org-b')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.rotate('raw-refresh', null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('refuses expired and unknown tokens', async () => {
    repo.findOne.mockResolvedValueOnce(
      row({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expect(service.rotate('raw', 'org-a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.rotate('raw', 'org-a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('caches an active session briefly and forgets it when revoked', async () => {
    await expect(service.isActive('fam-1')).resolves.toBe(true);
    await expect(service.isActive('fam-1')).resolves.toBe(true);
    expect(repo.exists).toHaveBeenCalledTimes(1);

    await service.revokeFamily('fam-1');
    repo.exists.mockResolvedValue(false);
    await expect(service.isActive('fam-1')).resolves.toBe(false);
  });

  it('only revokes a session that belongs to the user on this host', async () => {
    repo.exists.mockResolvedValueOnce(false);
    await expect(service.revokeOwn('user-2', 'org-a', 'fam-1')).resolves.toBe(
      false,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('signs out everywhere except the session that asked', async () => {
    repo.find.mockResolvedValue([{ familyId: 'fam-2' }]);

    await service.revokeAllForUser('user-1', 'fam-1');

    const [criteria] = repo.update.mock.calls[0] as [Record<string, unknown>];
    expect(criteria).toMatchObject({ userId: 'user-1' });
    expect(criteria.familyId).toBeDefined(); // Not('fam-1')
  });

  describe('idle timeout (school setting)', () => {
    it('refuses and revokes a sign-in unused for longer than the limit', async () => {
      idleMinutes = 30;
      repo.findOne.mockResolvedValue(
        row({ lastUsedAt: new Date(Date.now() - 31 * 60_000) }),
      );

      await expect(service.rotate('raw', 'org-a')).rejects.toMatchObject({
        response: { code: 'SESSION_IDLE_TIMEOUT' },
      });
      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'fam-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('rotates a sign-in used within the limit', async () => {
      idleMinutes = 30;
      repo.findOne.mockResolvedValue(
        row({ lastUsedAt: new Date(Date.now() - 5 * 60_000) }),
      );

      await expect(service.rotate('raw', 'org-a')).resolves.toMatchObject({
        userId: 'user-1',
      });
    });

    it('has no limit when the school sets none, or on the platform', async () => {
      const old = new Date(Date.now() - 10 * DAY);
      repo.findOne.mockResolvedValue(row({ lastUsedAt: old }));
      await expect(service.rotate('raw', 'org-a')).resolves.toBeDefined();

      idleMinutes = 30;
      repo.findOne.mockResolvedValue(row({ orgId: null, lastUsedAt: old }));
      await expect(service.rotate('raw', null)).resolves.toBeDefined();
    });
  });
});
