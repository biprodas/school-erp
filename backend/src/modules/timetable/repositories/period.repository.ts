import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Period } from '../entities/period.entity';

@Injectable()
export class PeriodRepository extends BaseTenantRepository<Period> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Period, 'Period');
  }

  findByName(name: string): Promise<Period | null> {
    return this.repo.findOne({ where: { name } });
  }

  findFiltered(where: Record<string, any>): Promise<Period[]> {
    return this.repo.find({
      where,
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }
}
