import type { DataSourceOptions } from 'typeorm';

/** The single shared schema holding platform and tenanted tables. */
export const PUBLIC_SCHEMA = 'public';

/**
 * TypeORM 1.x defaults, set explicitly so the choice is visible: `null` or
 * `undefined` in a find/update/delete `where` throws instead of silently
 * dropping the filter. Match NULL with `IsNull()`. (Org-scoped repositories
 * strip `undefined` keys first, see `scopeWhere`.)
 */
export const INVALID_WHERE_VALUES_BEHAVIOR = {
  null: 'throw',
  undefined: 'throw',
} as const satisfies DataSourceOptions['invalidWhereValuesBehavior'];
