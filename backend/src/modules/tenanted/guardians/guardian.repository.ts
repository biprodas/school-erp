import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Guardian } from './entities/guardian.entity';

@Injectable()
export class GuardianRepository extends BaseTenantRepository<Guardian> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Guardian, 'Guardian');
  }

  findByIdWithUser(id: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { id }, relations: ['user'] });
  }

  findByUserId(userId: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findFiltered(where: Record<string, any>): Promise<Guardian[]> {
    return this.repo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
