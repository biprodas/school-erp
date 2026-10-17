import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TENANT_POOL_DATASOURCE } from './tenancy.constants';
import { TenantDataSourceProxy } from './tenant-datasource.proxy';
import { ORG_SETTING } from './rls';

@Injectable()
export class TenantConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(TenantConnectionService.name);

  constructor(
    @Inject(TENANT_POOL_DATASOURCE)
    private readonly tenantPool: DataSource,
  ) {}

  /**
   * Acquires a connection from the shared (restricted-role) pool, sets the
   * `app.org_id` session setting that the row-level security policies read,
   * and returns a proxy that services can use like a DataSource (via
   * `getRepository()`).
   *
   * The caller (or TenantCleanupInterceptor) MUST call `proxy.release()`
   * to reset the setting and return the connection to the pool.
   */
  async getScopedConnection(orgId: string): Promise<TenantDataSourceProxy> {
    const queryRunner = this.tenantPool.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query(`SELECT set_config($1, $2, false)`, [
        ORG_SETTING,
        orgId,
      ]);
    } catch (err) {
      await queryRunner.release();
      throw err;
    }

    return new TenantDataSourceProxy(queryRunner.manager, queryRunner, orgId);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.tenantPool?.isInitialized) {
      await this.tenantPool.destroy();
      this.logger.log('Tenant pool DataSource closed');
    }
  }
}
