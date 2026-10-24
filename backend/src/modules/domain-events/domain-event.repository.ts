import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { DomainEvent } from './entities/domain-event.entity';

@Injectable()
export class DomainEventRepository extends BaseTenantRepository<DomainEvent> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, DomainEvent, 'DomainEvent');
  }

  async markProcessed(id: string): Promise<void> {
    await this.repo.update({ id }, { processedAt: new Date() });
  }
}
