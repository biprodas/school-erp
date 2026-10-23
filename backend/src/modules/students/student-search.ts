/**
 * Expressions the trigram indexes cover. Queries must use exactly these so
 * Postgres can use the indexes (`||` and `coalesce` are immutable, unlike
 * `concat_ws`). Shared by the migration, the dev bootstrap and the search.
 */
const col = (alias: string, name: string) =>
  alias ? `${alias}."${name}"` : `"${name}"`;

export const STUDENT_NAME_EXPR = (alias = '') =>
  `lower(${col(alias, 'first_name')} || coalesce(' ' || ${col(alias, 'middle_name')}, '') || ' ' || ${col(alias, 'last_name')})`;

export const STUDENT_NAME_BN_EXPR = (alias = '') =>
  `coalesce(${col(alias, 'name_bn')}, '')`;

/** The extension and `CREATE INDEX` statements for the search (idempotent). */
export const STUDENT_SEARCH_DDL = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `CREATE INDEX IF NOT EXISTS "idx_students_name_trgm" ON "students" USING gin ((${STUDENT_NAME_EXPR()}) gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS "idx_students_name_bn_trgm" ON "students" USING gin ((${STUDENT_NAME_BN_EXPR()}) gin_trgm_ops)`,
];

/** Escapes `%`, `_` and `\\` for a LIKE pattern. */
export const likeEscape = (text: string) => text.replace(/[\\%_]/g, '\\$&');
