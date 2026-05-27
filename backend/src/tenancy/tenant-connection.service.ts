import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { DbConfig } from '../config/db.config';
import { TENANT_POOL_DATASOURCE } from './tenancy.constants';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';
import { createTenantSchemaSyncDataSourceOptions } from './tenant.datasource';

@Injectable()
export class TenantConnectionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TenantConnectionService.name);

  constructor(
    @Inject(TENANT_POOL_DATASOURCE)
    private readonly tenantPool: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Acquires a connection from the shared pool, sets the search_path to
   * the given tenant schema, and returns a proxy that services can use
   * exactly like a DataSource (via `getRepository()`).
   *
   * The caller (or TenantCleanupInterceptor) MUST call `proxy.release()`
   * to return the connection to the pool.
   */
  async getScopedConnection(
    schemaName: string,
  ): Promise<TenantDataSourceProxy> {
    const queryRunner = this.tenantPool.createQueryRunner();
    await queryRunner.connect();

    const quoted = schemaName.replace(/"/g, '""');
    await queryRunner.query(`SET search_path TO "${quoted}", public`);

    return new TenantDataSourceProxy(queryRunner.manager, queryRunner);
  }

  /**
   * Synchronize tenant schema tables (development only).
   * Throws in production — use migrations instead.
   */
  async synchronizeSchema(schemaName: string): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'production') {
      throw new Error(
        'synchronizeSchema() is disabled in production. Use migrations instead.',
      );
    }

    const db = this.configService.get<DbConfig>('db')!;
    const tmpDs = new DataSource(
      createTenantSchemaSyncDataSourceOptions(db, schemaName),
    );

    await tmpDs.initialize();
    try {
      await tmpDs.synchronize();
      this.logger.log(`Schema synchronized: ${schemaName}`);
    } finally {
      await tmpDs.destroy();
    }
  }

  /**
   * Dev-only: on boot, re-synchronize every existing tenant schema so entity
   * changes (new columns, etc.) propagate without manual ALTERs. Skipped in
   * production and when `db.sync` is disabled — those paths must use migrations.
   * Per-tenant failures are logged but never abort the boot.
   */
  async onApplicationBootstrap(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const db = this.configService.get<DbConfig>('db');
    if (nodeEnv === 'production' || !db?.sync) {
      return;
    }

    let schemas: string[];
    try {
      const rows = await this.tenantPool.query<{ schema_name: string }[]>(
        'SELECT schema_name FROM public.tenants',
      );
      schemas = rows.map((r) => r.schema_name).filter(Boolean);
    } catch (err) {
      this.logger.warn(
        `Skipping tenant schema re-sync: could not read public.tenants (${(err as Error).message})`,
      );
      return;
    }

    if (!schemas.length) {
      return;
    }

    this.logger.log(`Re-syncing ${schemas.length} tenant schema(s) on boot`);
    for (const schema of schemas) {
      try {
        await this.synchronizeSchema(schema);
      } catch (err) {
        this.logger.error(
          `Failed to re-sync tenant schema "${schema}": ${(err as Error).message}`,
        );
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.tenantPool?.isInitialized) {
      await this.tenantPool.destroy();
      this.logger.log('Tenant pool DataSource closed');
    }
  }
}
