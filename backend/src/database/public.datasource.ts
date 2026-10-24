import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { envFilePaths } from '../config/env-files';
import {
  INVALID_WHERE_VALUES_BEHAVIOR,
  PUBLIC_SCHEMA,
} from './database.constants';

/**
 * DataSource used by the TypeORM CLI (`npm run migration:*`). It connects as
 * the owner role, like the app's root connection, and is never imported by
 * the Nest app.
 *
 * Env files are loaded the same way as `ConfigModule` in `app.module.ts`
 * (`envFilePaths`). Values that are already set (shell, or an earlier file)
 * win.
 */
for (const file of envFilePaths()) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) process.loadEnvFile(path);
}

export const publicDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: PUBLIC_SCHEMA,
  entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true' ? ['query', 'error'] : ['error'],
  invalidWhereValuesBehavior: INVALID_WHERE_VALUES_BEHAVIOR,
  ...(process.env.DB_SSL === 'true'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
};

const publicDataSource = new DataSource(publicDataSourceOptions);
export default publicDataSource;
