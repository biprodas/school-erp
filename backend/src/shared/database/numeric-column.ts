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

/**
 * Money is `bigint` minor units (poisha) in the database; Postgres returns
 * it as a string. Amounts stay far below 2^53, so read them as numbers.
 */
export const MoneyColumn: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
