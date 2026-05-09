import { registerAs } from '@nestjs/config';
import type { LoggerOptions } from 'typeorm';

export interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  sync: boolean;
  logging: LoggerOptions;
  ssl: boolean;
  tenantPoolSize: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
}

export default registerAs('db', (): DbConfig => ({
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  sync: process.env.DB_SYNC === 'true',
  logging: process.env.DB_LOGGING === 'true' ? ['query', 'error', 'schema'] : false,
  ssl: process.env.DB_SSL === 'true',
  tenantPoolSize: parseInt(process.env.DB_TENANT_POOL_SIZE ?? '20', 10),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT ?? '5000', 10),
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT ?? '10000', 10),
  maxLifetime: parseInt(process.env.DB_MAX_LIFETIME ?? '1800000', 10),
}));
