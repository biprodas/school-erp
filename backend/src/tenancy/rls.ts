import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Session setting the RLS policies compare `org_id` against. */
export const ORG_SETTING = 'app.org_id';

/** Name of the policy created on every org-scoped table. */
export const ORG_POLICY = 'org_isolation';

const logger = new Logger('RowLevelSecurity');

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;
const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * Tables that carry a NOT NULL `org_id` column, i.e. org-owned data. Tables
 * with a nullable `org_id` (e.g. `auth_tokens`) are global and stay
 * unrestricted.
 */
export function orgScopedTables(ds: DataSource): string[] {
  const tables = ds.entityMetadatas
    .filter((meta) =>
      meta.columns.some(
        (col) => col.databaseName === 'org_id' && !col.isNullable,
      ),
    )
    .map((meta) => meta.tableName);
  return [...new Set(tables)].sort();
}

/**
 * Dev bootstrap: creates the restricted login role the tenant pool connects
 * as (if missing). It is NOT a superuser and does not own any table, so the
 * RLS policies apply to it. In production, create the role out-of-band.
 */
export async function ensureAppRole(
  ds: DataSource,
  username: string,
  password: string,
): Promise<void> {
  await ds.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(username)}) THEN
        CREATE ROLE ${quoteIdent(username)} LOGIN PASSWORD ${quoteLiteral(password)}
          NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
    END
    $$;
  `);
}

/**
 * Global tables the tenant pool uses besides the org-scoped ones: accounts
 * (sign-in, password and profile flows) and auth tokens.
 */
export const APP_ROLE_GLOBAL_TABLES = ['users', 'auth_tokens'];

/**
 * Org-scoped tables the app role may only read and append to, so their rows
 * can't be changed or removed through the app (the audit log).
 */
export const APP_ROLE_APPEND_ONLY_TABLES = ['audit_logs'];

/**
 * Gives the restricted app role DML on exactly the tables tenant requests
 * use, and nothing else (no `organizations`, no `migrations`, no future
 * tables by default). Mirrors the AppRoleGrants migration.
 */
async function grantAppRole(
  ds: DataSource,
  appRole: string,
  orgTables: string[],
): Promise<void> {
  const role = quoteIdent(appRole);
  const tables = [...orgTables, ...APP_ROLE_GLOBAL_TABLES]
    .map((t) => `public.${quoteIdent(t)}`)
    .join(', ');
  await ds.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await ds.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`);
  await ds.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${role}`,
  );
  await ds.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tables} TO ${role}`,
  );
  for (const table of APP_ROLE_APPEND_ONLY_TABLES) {
    if (!orgTables.includes(table)) continue;
    await ds.query(
      `REVOKE UPDATE, DELETE ON public.${quoteIdent(table)} FROM ${role}`,
    );
  }
  await ds.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
  );
}

/**
 * Idempotently (re)applies row-level security to every org-scoped table and
 * grants the app role DML on the tables tenant requests use. Run with the owner (root)
 * connection after the schema is synchronized.
 *
 * Policies use `ENABLE` (not `FORCE`), so the table owner — the root
 * connection used by platform code, seeding and migrations — keeps full
 * access, while the app role only ever sees rows whose `org_id` matches
 * `current_setting('app.org_id')`. When the setting is unset/empty the
 * comparison is NULL, so no rows are visible (fail closed).
 */
export async function applyRowLevelSecurity(
  ds: DataSource,
  appRole: string | null,
): Promise<void> {
  const tables = orgScopedTables(ds);
  const orgExpr = `NULLIF(current_setting('${ORG_SETTING}', true), '')::uuid`;

  for (const table of tables) {
    const t = `public.${quoteIdent(table)}`;
    await ds.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await ds.query(`DROP POLICY IF EXISTS ${ORG_POLICY} ON ${t}`);
    await ds.query(
      `CREATE POLICY ${ORG_POLICY} ON ${t} USING (org_id = ${orgExpr}) WITH CHECK (org_id = ${orgExpr})`,
    );
  }

  if (appRole) {
    await grantAppRole(ds, appRole, tables);
  }

  logger.log(`Row-level security applied to ${tables.length} table(s)`);
}
