import type { ValueTransformer } from 'typeorm';

/**
 * Postgres returns `numeric` columns as strings (to keep their precision);
 * marks, weights and grade points fit a JS number, so read them as one.
 * Use with `type: 'numeric'`.
 */
export const NumericColumn: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
