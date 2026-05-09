import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { DbConfig } from '../config/db.config';
import { TENANT_POOL_DATASOURCE } from './tenancy.constants';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';
import { createTenantSchemaSyncDataSourceOptions } from './tenant.datasource';

@Injectable()
export class TenantConnectionService implements OnApplicationShutdown {
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
  async getScopedConnection(schemaName: string): Promise<TenantDataSourceProxy> {
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

  async onApplicationShutdown(): Promise<void> {
    if (this.tenantPool?.isInitialized) {
      await this.tenantPool.destroy();
      this.logger.log('Tenant pool DataSource closed');
    }
  }
}
