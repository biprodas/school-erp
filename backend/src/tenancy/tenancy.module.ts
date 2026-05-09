import { Global, Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { DbConfig } from '../config/db.config';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantMigrationService } from './tenant-migration.service';
import { createTenantPoolDataSourceOptions } from './tenant.datasource';
import { TENANT_DATASOURCE, TENANT_POOL_DATASOURCE } from './tenancy.constants';
import { TenantContextMissingException } from './exceptions/tenant.exceptions';
import { attachProxyToRequest } from './tenant-cleanup.interceptor';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: TENANT_POOL_DATASOURCE,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<DataSource> => {
        const db = configService.get<DbConfig>('db')!;
        const ds = new DataSource(createTenantPoolDataSourceOptions(db));

        await ds.initialize();
        return ds;
      },
    },
    TenantConnectionService,
    TenantMigrationService,
    {
      provide: TENANT_DATASOURCE,
      scope: Scope.REQUEST,
      inject: [REQUEST, TenantConnectionService],
      useFactory: async (req: any, tenantConn: TenantConnectionService) => {
        const schema = req.tenantSchema;
        if (!schema) {
          throw new TenantContextMissingException();
        }
        const proxy = await tenantConn.getScopedConnection(schema);
        attachProxyToRequest(req, proxy);
        return proxy;
      },
    },
  ],
  exports: [TenantConnectionService, TenantMigrationService, TENANT_DATASOURCE],
})
export class TenancyModule {}
