import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Section } from './entities/section.entity';

@Injectable()
export class SectionRepository extends BaseTenantRepository<Section> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Section, 'Section');
  }

  findByName(name: string): Promise<Section | null> {
    return this.repo.findOne({ where: { name } });
  }

  findFiltered(where: Record<string, any>): Promise<Section[]> {
    return this.repo.find({ where, order: { name: 'ASC' } });
  }
}
