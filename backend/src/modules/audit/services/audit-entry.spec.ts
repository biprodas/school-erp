import { AUDIT_ACTIONS } from '../audit-actions';
import { AuditActorType } from '../enums/audit-actor-type.enum';
import { auditRow, redactSecrets } from './audit-entry';
import type { RequestContextSnapshot } from '~/shared/request-context/request-context.service';

const ctx = (
  overrides: Partial<RequestContextSnapshot> = {},
): RequestContextSnapshot => ({
  orgId: 'org-1',
  userId: 'u-signed-in',
  isAdmin: false,
  sessionId: 's-1',
  ip: '203.0.113.7',
  userAgent: 'jest',
  requestId: 'req-1',
  ...overrides,
});

describe('redactSecrets', () => {
  it('drops secret-looking keys at any depth and keeps the rest', () => {
    expect(
      redactSecrets({
        name: 'Rahim',
        password: 'x',
        tokenHash: 'y',
        refresh_token: 'z',
        notPaid: true,
        nested: { clientSecret: 'a', ok: 1, list: [{ otp: '123', keep: 2 }] },
      }),
    ).toEqual({
      name: 'Rahim',
      notPaid: true,
      nested: { ok: 1, list: [{ keep: 2 }] },
    });
  });

  it('matches exact names and suffixes, not words inside a key', () => {
    expect(
      redactSecrets({
        passMark: 33,
        mustChangePassword: true,
        passwordChangedAt: 'x',
        hashtag: 'keep',
        password: 'x',
        passwordHash: 'x',
        tokenHash: 'x',
        refresh_token: 'x',
        resetToken: 'x',
        accessToken: 'x',
        token: 'x',
        a: { password: 'x', b: 1 },
      }),
    ).toEqual({
      passMark: 33,
      mustChangePassword: true,
      passwordChangedAt: 'x',
      hashtag: 'keep',
      a: { b: 1 },
    });
  });

  it('keeps dates and drops undefined values', () => {
    const at = new Date();
    expect(redactSecrets({ at, gone: undefined })).toEqual({ at });
  });
});

describe('auditRow', () => {
  const entry = { action: AUDIT_ACTIONS.ROLE_UPDATED, entityType: 'role' };

  it('takes the actor, IP, user agent and request id from the context', () => {
    expect(auditRow(entry, ctx())).toMatchObject({
      action: 'role.updated',
      entityType: 'role',
      entityId: null,
      actorUserId: 'u-signed-in',
      actorType: AuditActorType.USER,
      ip: '203.0.113.7',
      userAgent: 'jest',
      requestId: 'req-1',
      impersonatorId: null,
    });
  });

  it('lets the caller name the actor (sign-in flows)', () => {
    expect(
      auditRow({ ...entry, actorUserId: 'u-login' }, ctx({ userId: null })),
    ).toMatchObject({ actorUserId: 'u-login', actorType: AuditActorType.USER });
  });

  it('records an explicit null actor as an anonymous user', () => {
    expect(auditRow({ ...entry, actorUserId: null }, ctx())).toMatchObject({
      actorUserId: null,
      actorType: AuditActorType.USER,
    });
  });

  it('records work without any actor as the system', () => {
    expect(auditRow(entry, ctx({ userId: null }))).toMatchObject({
      actorUserId: null,
      actorType: AuditActorType.SYSTEM,
    });
  });

  it('records an actor other than the signed-in user as a user', () => {
    expect(
      auditRow(
        { ...entry, actorUserId: 'u-other' },
        ctx(),
        AuditActorType.PLATFORM,
      ).actorType,
    ).toBe(AuditActorType.USER);
  });

  it('keeps an explicit actor type', () => {
    expect(
      auditRow({ ...entry, actorType: AuditActorType.SYSTEM }, ctx()).actorType,
    ).toBe(AuditActorType.SYSTEM);
  });

  it('uses the realm type for a signed-in actor', () => {
    expect(auditRow(entry, ctx(), AuditActorType.PLATFORM).actorType).toBe(
      AuditActorType.PLATFORM,
    );
  });

  it('redacts before and after', () => {
    const row = auditRow(
      { ...entry, before: { password: 'old' }, after: { name: 'n' } },
      ctx(),
    );
    expect(row.before).toEqual({});
    expect(row.after).toEqual({ name: 'n' });
  });
});
