import { ForbiddenException } from '@nestjs/common';
import { In, ObjectLiteral, Repository } from 'typeorm';

/** Property name of the discriminator on every org-scoped entity. */
export const ORG_ID_PROPERTY = 'orgId';

type Where = Record<string, unknown> | Record<string, unknown>[] | undefined;

/** Adds (or overrides) `orgId` on a where clause; arrays get it on every OR branch. */
export function scopeWhere(where: Where, orgId: string): Where {
  if (Array.isArray(where)) {
    return where.length
      ? where.map((w) => ({ ...w, [ORG_ID_PROPERTY]: orgId }))
      : [{ [ORG_ID_PROPERTY]: orgId }];
  }
  return { ...(where ?? {}), [ORG_ID_PROPERTY]: orgId };
}

/**
 * Turns delete/update criteria (id, id[], or where object) into a where
 * object pinned to the org.
 */
function scopeCriteria(criteria: unknown, orgId: string) {
  if (typeof criteria === 'string' || typeof criteria === 'number') {
    return { id: criteria, [ORG_ID_PROPERTY]: orgId };
  }
  if (Array.isArray(criteria)) {
    const ids = criteria.filter(
      (c) => typeof c === 'string' || typeof c === 'number',
    );
    if (ids.length === criteria.length) {
      return { id: In(ids), [ORG_ID_PROPERTY]: orgId };
    }
    return scopeWhere(criteria as Record<string, unknown>[], orgId);
  }
  return scopeWhere(criteria as Record<string, unknown>, orgId);
}

/** Stamps `orgId` on new data and rejects data that targets another org. */
function stampOrg<D>(data: D, orgId: string): D {
  if (Array.isArray(data)) {
    data.forEach((d: unknown) => stampOrg(d, orgId));
    return data;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const current = record[ORG_ID_PROPERTY];
    if (current !== undefined && current !== null && current !== orgId) {
      throw new ForbiddenException('Cross-organization write blocked');
    }
    record[ORG_ID_PROPERTY] = orgId;
  }
  return data;
}

/**
 * remove/softRemove/recover act on loaded entities by primary key only, so
 * each one must already carry this org's `orgId` (i.e. it was loaded through
 * the scoped repository).
 */
function assertSameOrg<D>(data: D, orgId: string): D {
  const items: unknown[] = Array.isArray(data) ? data : [data];
  for (const item of items) {
    const current = (item as Record<string, unknown> | null)?.[ORG_ID_PROPERTY];
    if (current !== orgId) {
      throw new ForbiddenException('Cross-organization write blocked');
    }
  }
  return data;
}

function scopeFindOptions(options: unknown, orgId: string) {
  const opts = (options ?? {}) as { where?: Where };
  return { ...opts, where: scopeWhere(opts.where, orgId) };
}

const FIND_OPTIONS_METHODS = new Set([
  'find',
  'findOne',
  'findOneOrFail',
  'findAndCount',
  'count',
  'exists',
  'exist',
]);
const WHERE_METHODS = new Set([
  'findBy',
  'findOneBy',
  'findOneByOrFail',
  'findAndCountBy',
  'countBy',
  'existsBy',
]);
/** `(columnName, where)` aggregates. */
const AGGREGATE_METHODS = new Set(['sum', 'average', 'minimum', 'maximum']);
/** `(conditions, propertyPath, value)` in-place arithmetic. */
const ARITHMETIC_METHODS = new Set(['increment', 'decrement']);
const CRITERIA_METHODS = new Set(['delete', 'softDelete', 'restore']);
const WRITE_METHODS = new Set(['create', 'save', 'insert']);
const LOADED_ENTITY_METHODS = new Set(['remove', 'softRemove', 'recover']);
/**
 * Members that would bypass the org filter and have no scoped equivalent
 * here. Use the scoped methods above, or `createQueryBuilder` with an
 * explicit `alias.orgId = :orgId` condition.
 */
const BLOCKED_MEMBERS = new Set([
  'upsert',
  'preload',
  'findByIds',
  'findOneById',
  'updateAll',
  'deleteAll',
  'clear',
  'query',
  'sql',
  'extend',
  'manager',
]);

/**
 * Wraps a TypeORM repository so every common read/write is pinned to one
 * organization (app-level isolation; RLS is the safety net underneath):
 *
 * - find/findOne/findAndCount/count/exists (+ `*By` variants) and the
 *   sum/average/minimum/maximum aggregates: `orgId` is merged into `where`
 *   (overriding any caller-supplied value).
 * - create/save/insert: `orgId` is stamped; data for another org throws.
 * - update/delete/softDelete/restore/increment/decrement: criteria are
 *   pinned to the org.
 * - remove/softRemove/recover: entities must belong to the org.
 * - upsert/preload/query/manager and other unscoped escape hatches throw.
 *
 * `createQueryBuilder` is NOT rewritten (a later `.where()` would drop an
 * injected condition) — add `alias.orgId = :orgId` yourself; RLS still
 * guards it. Repositories for entities without an `orgId` column (e.g. the
 * global `users` table) should not be wrapped.
 */
export function scopeRepository<T extends ObjectLiteral>(
  repo: Repository<T>,
  orgId: string,
): Repository<T> {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && BLOCKED_MEMBERS.has(prop)) {
        throw new Error(
          `Repository.${prop} is not available on org-scoped repositories`,
        );
      }
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string' || typeof value !== 'function') {
        return value;
      }
      const method = value as (...args: unknown[]) => unknown;
      const call = (...args: unknown[]): unknown =>
        Reflect.apply(method, target, args);

      if (FIND_OPTIONS_METHODS.has(prop)) {
        return (options?: unknown) => call(scopeFindOptions(options, orgId));
      }
      if (WHERE_METHODS.has(prop)) {
        return (where?: Where) => call(scopeWhere(where, orgId));
      }
      if (AGGREGATE_METHODS.has(prop)) {
        return (column: unknown, where?: Where) =>
          call(column, scopeWhere(where, orgId));
      }
      if (ARITHMETIC_METHODS.has(prop)) {
        return (conditions: Where, ...rest: unknown[]) =>
          call(scopeWhere(conditions, orgId), ...rest);
      }
      if (CRITERIA_METHODS.has(prop)) {
        return (criteria: unknown) => call(scopeCriteria(criteria, orgId));
      }
      if (prop === 'update') {
        return (criteria: unknown, partial: Record<string, unknown>) => {
          const current = partial?.[ORG_ID_PROPERTY];
          if (current !== undefined && current !== orgId) {
            throw new ForbiddenException('Cross-organization write blocked');
          }
          return call(scopeCriteria(criteria, orgId), partial);
        };
      }
      if (WRITE_METHODS.has(prop)) {
        return (data?: unknown, ...rest: unknown[]) =>
          call(stampOrg(data ?? {}, orgId), ...rest);
      }
      if (LOADED_ENTITY_METHODS.has(prop)) {
        return (data: unknown, ...rest: unknown[]) =>
          call(assertSameOrg(data, orgId), ...rest);
      }
      return method.bind(target) as unknown;
    },
  });
}
