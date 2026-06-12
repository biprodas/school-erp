import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Stakeholder } from './entities/stakeholder.entity';

@Injectable()
export class StakeholderRepository extends BaseTenantRepository<Stakeholder> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Stakeholder, 'Stakeholder');
  }

  findByIdWithUser(id: string): Promise<Stakeholder | null> {
    return this.repo.findOne({ where: { id }, relations: ['user'] });
  }

  findByUserId(userId: string): Promise<Stakeholder | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findFiltered(where: Record<string, any>): Promise<Stakeholder[]> {
    return this.repo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
