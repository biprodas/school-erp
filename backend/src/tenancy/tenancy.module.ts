import { Global, Logger, Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DbConfig } from '../config/db.config';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantJobRunner } from './tenant-job.runner';
import { createTenantPoolDataSourceOptions } from './tenant.datasource';
import { TENANT_DATASOURCE, TENANT_POOL_DATASOURCE } from './tenancy.constants';
import { TenantContextMissingException } from './exceptions/tenant.exceptions';
import { attachProxyToRequest } from './tenant-cleanup.interceptor';
import { applyRowLevelSecurity, ensureAppRole } from './rls';
import type { RequestWithOrg } from './tenant.middleware';

const logger = new Logger('TenancyModule');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: TENANT_POOL_DATASOURCE,
      // The root DataSource is injected so it is initialized (and, in dev,
      // synchronized) before RLS is applied and the pool connects.
      inject: [ConfigService, getDataSourceToken()],
      useFactory: async (
        configService: ConfigService,
        rootDs: DataSource,
      ): Promise<DataSource> => {
        const db = configService.get<DbConfig>('db')!;
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';

        if (!isProduction) {
          if (db.appUsername && db.appPassword) {
            await ensureAppRole(rootDs, db.appUsername, db.appPassword);
          }
          await applyRowLevelSecurity(rootDs, db.appUsername ?? null);
        }
        if (!db.appUsername) {
          logger.warn(
            'DB_APP_USERNAME is not set: the tenant pool uses the owner role, which bypasses row-level security.',
          );
        }

        const ds = new DataSource(createTenantPoolDataSourceOptions(db));
        await ds.initialize();
        return ds;
      },
    },
    TenantConnectionService,
    TenantJobRunner,
    {
      provide: TENANT_DATASOURCE,
      scope: Scope.REQUEST,
      inject: [REQUEST, TenantConnectionService],
      useFactory: async (
        req: RequestWithOrg,
        tenantConn: TenantConnectionService,
      ) => {
        const orgId = req.orgId;
        if (!orgId) {
          throw new TenantContextMissingException();
        }
        const proxy = await tenantConn.getScopedConnection(orgId);
        attachProxyToRequest(req, proxy);
        return proxy;
      },
    },
  ],
  exports: [TenantConnectionService, TenantJobRunner, TENANT_DATASOURCE],
})
export class TenancyModule {}
