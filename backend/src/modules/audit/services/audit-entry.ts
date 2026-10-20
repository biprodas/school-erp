import type { AuditAction } from '../audit-actions';
import { AuditActorType } from '../enums/audit-actor-type.enum';
import type { RequestContextSnapshot } from '~/shared/request-context/request-context.service';

/** One audited action, as callers describe it. */
export interface AuditEntry {
  action: AuditAction;
  entityType?: string;
  entityId?: string | null;
  /** State before the change (omit for creations). Secrets are dropped. */
  before?: Record<string, unknown> | null;
  /** State after the change, or event details. Secrets are dropped. */
  after?: Record<string, unknown> | null;
  /**
   * Who acted, when it isn't the signed-in user of the request (sign-in
   * flows, where nobody is signed in yet). `null` records an anonymous event.
   */
  actorUserId?: string | null;
  actorType?: AuditActorType;
}

/** Keys never written to the log, at any depth (compared case-insensitively). */
const SECRET_KEYS = new Set([
  'password',
  'passwordhash',
  'secret',
  'otp',
  'token',
  'refreshtoken',
  'accesstoken',
]);

/**
 * Suffixes that mark a secret, either case on the first letter: `resetToken`,
 * `refresh_token`, `tokenHash`, `client_secret`. Exact names and suffixes only, so `passMark`,
 * `mustChangePassword` and `passwordChangedAt` are kept.
 */
const SECRET_SUFFIX = /(?:[Tt]oken|[Hh]ash|[Ss]ecret)$/;

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase()) || SECRET_SUFFIX.test(key);
}

/** Copies a value without secret-looking keys (`password`, `tokenHash`, …). */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactSecrets) as T;
  if (value instanceof Date || value === null || typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (!isSecretKey(key) && v !== undefined) out[key] = redactSecrets(v);
  }
  return out as T;
}

/**
 * The row columns for an entry, given the request context. The signed-in
 * actor gets `signedInType` (`user` in a school, `platform` for a
 * super-admin on the platform log); an actor named by the caller (sign-in
 * flows) or an explicit `null` one (anonymous) is a `user`; no actor at all
 * is the system (a job without an actor). `entry.actorType` wins over all.
 */
export function auditRow(
  entry: AuditEntry,
  ctx: RequestContextSnapshot,
  signedInType: AuditActorType = AuditActorType.USER,
) {
  const actorUserId =
    entry.actorUserId !== undefined ? entry.actorUserId : ctx.userId;
  const actorType =
    entry.actorType ??
    (actorUserId && actorUserId === ctx.userId
      ? signedInType
      : actorUserId || entry.actorUserId === null
        ? AuditActorType.USER
        : AuditActorType.SYSTEM);
  return {
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    before: entry.before ? redactSecrets(entry.before) : null,
    after: entry.after ? redactSecrets(entry.after) : null,
    actorUserId,
    actorType,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
    impersonatorId: null,
  };
}
