import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { DbConfig } from '../config/db.config';
import { Tenant } from '../modules/platform/tenants/entities/tenant.entity';
import { TenantStatus } from '../modules/platform/tenants/enums/tenant-status.enum';

export interface MigrationResult {
  schema: string;
  status: 'success' | 'failed';
  migrationsRun?: number;
  error?: string;
}

@Injectable()
export class TenantMigrationService {
  private readonly logger = new Logger(TenantMigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly publicDs: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Runs pending migrations for a single tenant schema.
   * Creates a temporary DataSource scoped to the schema, runs migrations,
   * then destroys it immediately.
   */
  async runMigrationsForSchema(schemaName: string): Promise<MigrationResult> {
    const db = this.configService.get<DbConfig>('db')!;

    const ds = new DataSource({
      type: 'postgres',
      host: db.host,
      port: db.port,
      username: db.username,
      password: db.password,
      database: db.database,
      schema: schemaName,
      entities: [],
      migrations: [
        __dirname + '/../migrations/tenant/*{.ts,.js}',
      ],
      migrationsTableName: '_migrations',
    });

    await ds.initialize();
    try {
      const migrations = await ds.runMigrations({ transaction: 'each' });
      this.logger.log(
        `Migrations for ${schemaName}: ${migrations.length} applied`,
      );
      return {
        schema: schemaName,
        status: 'success',
        migrationsRun: migrations.length,
      };
    } catch (error) {
      this.logger.error(
        `Migration failed for ${schemaName}: ${(error as Error).message}`,
      );
      return {
        schema: schemaName,
        status: 'failed',
        error: (error as Error).message,
      };
    } finally {
      await ds.destroy();
    }
  }

  /**
   * Runs pending migrations across all active tenant schemas.
   * Failures on one tenant do not prevent others from migrating.
   */
  async runMigrationsForAllTenants(): Promise<MigrationResult[]> {
    const tenants = await this.publicDs.getRepository(Tenant).find({
      where: { status: TenantStatus.ACTIVE },
    });

    this.logger.log(
      `Running migrations for ${tenants.length} active tenants`,
    );

    const results: MigrationResult[] = [];
    for (const tenant of tenants) {
      const result = await this.runMigrationsForSchema(tenant.schemaName);
      results.push(result);
    }

    const failed = results.filter((r) => r.status === 'failed');
    if (failed.length) {
      this.logger.warn(
        `Migrations failed for ${failed.length}/${results.length} tenants`,
      );
    }

    return results;
  }
}
