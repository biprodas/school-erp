import { DataSource } from 'typeorm';
import 'dotenv/config';

/**
 * Standalone DataSource for generating tenant schema migrations via
 * the TypeORM CLI:
 *
 *   npx typeorm migration:generate src/migrations/tenant/MigrationName \
 *     -d src/database/tenant-migration.datasource.ts
 *
 * This DataSource points at a temporary schema (used only during
 * migration generation) and loads all tenanted entities.
 */
const tenantMigrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: process.env.MIGRATION_SCHEMA ?? 'tenant_migration_tmp',
  entities: [__dirname + '/../modules/tenanted/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/tenant/*{.ts,.js}'],
  migrationsTableName: '_migrations',
  synchronize: false,
});

export default tenantMigrationDataSource;
