import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Designation } from './entities/designation.entity';

@Injectable()
export class DesignationRepository extends BaseTenantRepository<Designation> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Designation, 'Designation');
  }

  findByTitle(title: string): Promise<Designation | null> {
    return this.repo.findOne({ where: { title } });
  }

  findFiltered(where: Record<string, any>): Promise<Designation[]> {
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
}
