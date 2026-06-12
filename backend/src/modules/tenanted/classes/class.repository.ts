import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Class } from './entities/class.entity';

const SECTION_RELATIONS = ['classSections', 'classSections.section'];

@Injectable()
export class ClassRepository extends BaseTenantRepository<Class> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Class, 'Class');
  }

  findByName(name: string): Promise<Class | null> {
    return this.repo.findOne({ where: { name } });
  }

  findByIdWithSections(id: string): Promise<Class | null> {
    return this.repo.findOne({ where: { id }, relations: SECTION_RELATIONS });
  }

  findFiltered(where: Record<string, any>): Promise<Class[]> {
    return this.repo.find({
      where,
      relations: SECTION_RELATIONS,
      order: { level: 'ASC', name: 'ASC' },
    });
  }
}
