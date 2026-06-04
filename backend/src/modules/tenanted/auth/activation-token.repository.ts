import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ActivationToken } from './entities/activation-token.entity';

@Injectable()
export class ActivationTokenRepository extends BaseTenantRepository<ActivationToken> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ActivationToken, 'ActivationToken');
  }

  findByHash(tokenHash: string): Promise<ActivationToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }
}
