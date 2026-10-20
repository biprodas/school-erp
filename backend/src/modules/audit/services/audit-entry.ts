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

/** Key words never written to the log, at any depth (`tokenHash`, `password`). */
const SECRET_WORDS = new Set([
  'password',
  'pass',
  'secret',
  'token',
  'hash',
  'otp',
]);

function isSecretKey(key: string): boolean {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => SECRET_WORDS.has(word));
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
 * The row columns for an entry, given the request context. A known actor
 * gets `signedInType` (`user` in a school, `platform` on the platform log);
 * an explicit `null` actor is an anonymous user; no actor at all is the
 * system (a job without an actor).
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
    (actorUserId
      ? signedInType
      : entry.actorUserId === null
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
