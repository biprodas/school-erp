import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { DbConfig } from '../config/db.config';
import { ALL_ENTITIES_GLOBS } from '~/tenancy/tenant.datasource';
import {
  INVALID_WHERE_VALUES_BEHAVIOR,
  PUBLIC_SCHEMA,
} from './database.constants';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get<DbConfig>('db');
        if (!db?.host || !db.username || !db.database) {
          throw new Error('Database configuration (db) is incomplete');
        }

        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';

        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          schema: PUBLIC_SCHEMA,
          // Platform + tenanted entities all live in the shared public schema.
          entities: ALL_ENTITIES_GLOBS,
          autoLoadEntities: true,
          synchronize: db.sync && !isProduction,
          logging: db.logging,
          invalidWhereValuesBehavior: INVALID_WHERE_VALUES_BEHAVIOR,
          ...(db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
          extra: {
            max: 10,
            connectionTimeoutMillis: db.connectionTimeout,
            idleTimeoutMillis: db.idleTimeout,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
