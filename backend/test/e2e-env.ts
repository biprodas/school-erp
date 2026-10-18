import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Loads `.env.development` and points the e2e run at its own database, so
 * tests that hit Postgres never touch dev data:
 *
 * - `DB_NAME` becomes `<DB_NAME>_e2e` (override with `E2E_DB_NAME`).
 * - The tenant pool connects as a restricted app role (default
 *   `school_erp_e2e_app`) so row-level security is enforced, as in production.
 * - A small tenant pool makes connection leaks show up quickly.
 *
 * Variables already set in the shell win over these defaults.
 */
export function loadE2eEnv(): void {
  const { parsed } = config({
    path: resolve(__dirname, '..', '.env.development'),
  });

  // Derived from the file (not process.env), so running this again in the
  // same Jest worker doesn't stack the suffix.
  const baseName = parsed?.DB_NAME ?? 'school_erp';
  process.env.DB_NAME = process.env.E2E_DB_NAME ?? `${baseName}_e2e`;
  process.env.DB_SYNC = 'true';
  process.env.DB_APP_USERNAME ||= 'school_erp_e2e_app';
  process.env.DB_APP_PASSWORD ||= 'school_erp_e2e_app_password';
  process.env.LOG_LEVEL ??= 'silent';
  process.env.DB_TENANT_POOL_SIZE = process.env.E2E_DB_TENANT_POOL_SIZE ?? '5';
}
