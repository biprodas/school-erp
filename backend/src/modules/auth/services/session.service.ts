import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import type { JwtConfig } from '~/config';
import type { ClientInfo } from '~/common/decorators/client.decorator';
import { generateToken, hashToken } from '~/common/tokens/secure-token.util';
import { UserSession } from '../entities/user-session.entity';

/** How long a positive "session is active" answer is reused per process. */
export const SESSION_CACHE_MS = 60_000;

export interface IssuedSession {
  /** The family id: goes into access tokens as `sid`. */
  sessionId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface RotatedSession extends IssuedSession {
  userId: string;
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  current: boolean;
}

/**
 * Refresh tokens and sign-in sessions for both realms (platform sessions
 * have a null `orgId`). Refresh tokens rotate on every use; presenting one
 * that was already used revokes its whole family. Uses the root connection:
 * sessions are identity data, not school data.
 */
@Injectable()
export class SessionService {
  private readonly ttlMs: number;
  private readonly activeCache = new Map<string, number>();

  constructor(
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    config: ConfigService,
  ) {
    this.ttlMs = config.get<JwtConfig>('jwt')!.refreshTtlMs;
  }

  /** Starts a new family after a successful sign-in. */
  async start(
    userId: string,
    orgId: string | null,
    client: Partial<ClientInfo> = {},
  ): Promise<IssuedSession> {
    return this.issue(userId, orgId, randomUUID(), client);
  }

  /**
   * Exchanges a refresh token for a new one in the same family. The token
   * must belong to `orgId` (the school whose host is calling, or null for
   * the platform).
   */
  async rotate(
    rawToken: string,
    orgId: string | null,
    client: Partial<ClientInfo> = {},
  ): Promise<RotatedSession> {
    const row = await this.sessions.findOne({
      where: { refreshHash: hashToken(rawToken) },
    });
    if (!row || (row.orgId ?? null) !== orgId) throw invalidRefresh();
    if (row.revokedAt) {
      // Already used: someone replayed or stole it. End the whole sign-in.
      await this.revokeFamily(row.familyId);
      throw invalidRefresh('REFRESH_TOKEN_REUSED');
    }
    if (row.expiresAt.getTime() <= Date.now()) throw invalidRefresh();
    // TODO(4.6): refuse when the school's idle timeout passed since lastUsedAt.

    // Atomic: of two concurrent refreshes with the same token, one loses.
    const claimed = await this.sessions.update(
      { id: row.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!claimed.affected) {
      await this.revokeFamily(row.familyId);
      throw invalidRefresh('REFRESH_TOKEN_REUSED');
    }
    const next = await this.issue(row.userId, orgId, row.familyId, {
      ip: client.ip ?? row.ip,
      userAgent: client.userAgent ?? row.userAgent,
      createdAt: row.createdAt,
    });
    return { ...next, userId: row.userId };
  }

  /** True while the family has an unrevoked, unexpired token. */
  async isActive(sessionId: string): Promise<boolean> {
    const cachedUntil = this.activeCache.get(sessionId);
    if (cachedUntil && cachedUntil > Date.now()) return true;
    const active = await this.sessions.exists({
      where: {
        familyId: sessionId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (active) this.activeCache.set(sessionId, Date.now() + SESSION_CACHE_MS);
    else this.activeCache.delete(sessionId);
    return active;
  }

  async revokeFamily(sessionId: string): Promise<void> {
    this.activeCache.delete(sessionId);
    await this.sessions.update(
      { familyId: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Revokes one of the user's sessions; false if it isn't theirs. */
  async revokeOwn(
    userId: string,
    orgId: string | null,
    sessionId: string,
  ): Promise<boolean> {
    const owned = await this.sessions.exists({
      where: { familyId: sessionId, userId, orgId: orgId ?? IsNull() },
    });
    if (owned) await this.revokeFamily(sessionId);
    return owned;
  }

  /**
   * Signs the user out everywhere (every school and the platform), except
   * `keepSessionId` when given (the session that changed the password).
   */
  async revokeAllForUser(
    userId: string,
    keepSessionId?: string,
  ): Promise<void> {
    const families = await this.sessions.find({
      select: { familyId: true },
      where: {
        userId,
        revokedAt: IsNull(),
        ...(keepSessionId ? { familyId: Not(keepSessionId) } : {}),
      },
    });
    for (const { familyId } of families) this.activeCache.delete(familyId);
    await this.sessions.update(
      {
        userId,
        revokedAt: IsNull(),
        ...(keepSessionId ? { familyId: Not(keepSessionId) } : {}),
      },
      { revokedAt: new Date() },
    );
  }

  /** Active sessions of the user on this host (one school, or the platform). */
  async listActive(
    userId: string,
    orgId: string | null,
    currentSessionId?: string,
  ): Promise<SessionSummary[]> {
    const heads = await this.sessions.find({
      where: {
        userId,
        orgId: orgId ?? IsNull(),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { lastUsedAt: 'DESC' },
    });
    return heads.map((s) => ({
      id: s.familyId,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s.familyId === currentSessionId,
    }));
  }

  private async issue(
    userId: string,
    orgId: string | null,
    familyId: string,
    client: Partial<ClientInfo> & { createdAt?: Date },
  ): Promise<IssuedSession> {
    const refreshToken = generateToken();
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + this.ttlMs);
    await this.sessions.insert({
      userId,
      orgId,
      familyId,
      refreshHash: hashToken(refreshToken),
      userAgent: client.userAgent?.slice(0, 255) ?? null,
      ip: client.ip?.slice(0, 64) ?? null,
      // The family's first sign-in time, so the device list shows it.
      ...(client.createdAt ? { createdAt: client.createdAt } : {}),
      lastUsedAt: now,
      expiresAt: refreshExpiresAt,
    });
    this.activeCache.set(familyId, Date.now() + SESSION_CACHE_MS);
    return { sessionId: familyId, refreshToken, refreshExpiresAt };
  }
}

function invalidRefresh(code = 'INVALID_REFRESH_TOKEN') {
  return new UnauthorizedException({
    message: 'Your session has expired. Please sign in again.',
    code,
  });
}
