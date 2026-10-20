import {
  And,
  FindOptionsWhere,
  LessThan,
  Like,
  MoreThanOrEqual,
} from 'typeorm';
import type { FilterAuditLogDto } from '../dto/filter-audit-log.dto';

interface AuditLogFields {
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  createdAt: Date;
}

/** Find conditions for the filters both audit logs share. */
export function auditLogWhere<T extends AuditLogFields>(
  filter: FilterAuditLogDto,
): FindOptionsWhere<T> {
  const where: FindOptionsWhere<AuditLogFields> = {};
  if (filter.action) {
    // `auth.` lists every sign-in event; a full name matches exactly. The
    // DTO only lets `[a-z_.]` through; `_` is a LIKE wildcard, so escape it.
    where.action = filter.action.endsWith('.')
      ? Like(`${filter.action.replace(/_/g, '\\_')}%`)
      : filter.action;
  }
  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = filter.entityId;
  if (filter.actorUserId) where.actorUserId = filter.actorUserId;
  const from = filter.from ? MoreThanOrEqual(new Date(filter.from)) : null;
  const to = filter.to ? LessThan(new Date(filter.to)) : null;
  if (from && to) where.createdAt = And(from, to);
  else if (from ?? to) where.createdAt = (from ?? to)!;
  return where as FindOptionsWhere<T>;
}
