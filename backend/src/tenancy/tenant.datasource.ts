import type { DataSourceOptions } from 'typeorm';
import type { DbConfig } from '../config/db.config';

/** Every entity lives in the shared `public` schema. */
export const ALL_ENTITIES_GLOBS = [
  __dirname + '/../modules/platform/**/entities/*.entity{.ts,.js}',
  __dirname + '/../modules/tenanted/**/entities/*.entity{.ts,.js}',
];

/**
 * Options for the shared tenant pool. It connects as the restricted app role
 * (`DB_APP_USERNAME`) so row-level security applies; falls back to the owner
 * credentials when no app role is configured (RLS is then bypassed and only
 * the app-level scoping protects tenants).
 */
export function createTenantPoolDataSourceOptions(
  db: DbConfig,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.appUsername ?? db.username,
    password: db.appUsername ? db.appPassword : db.password,
    database: db.database,
    schema: 'public',
    entities: ALL_ENTITIES_GLOBS,
    synchronize: false,
    logging: db.logging,
    ...(db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
    extra: {
      max: db.tenantPoolSize,
      connectionTimeoutMillis: db.connectionTimeout,
      idleTimeoutMillis: db.idleTimeout,
      maxLifetimeMillis: db.maxLifetime,
    },
  };
}
