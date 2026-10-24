import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Environment for `scripts/perf-seed.ts`, imported before anything that
 * loads AppModule (its config is read at import time). Shell variables win;
 * `.env.development` fills the rest, like the e2e setup. The seed runs with
 * `NODE_ENV=test` (inline queue and memory cache, no cron jobs) against its
 * own database.
 */
config({ path: resolve(__dirname, '..', '.env.development'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.PERF_DB_NAME ?? 'school_erp_perf';
process.env.DB_SYNC ??= 'true';
process.env.DB_APP_USERNAME ||= 'school_erp_app';
process.env.DB_APP_PASSWORD ||= 'school_erp_app';
process.env.DB_TENANT_POOL_SIZE ??= '20';
process.env.LOG_LEVEL ??= 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.QUEUE_DRIVER = 'inline';
process.env.PDF_NO_SANDBOX ??= 'true';
