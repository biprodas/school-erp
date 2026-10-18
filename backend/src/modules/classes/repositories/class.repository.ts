import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Class } from '../entities/class.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const SECTION_RELATIONS: FindOptionsRelations<Class> = {
  classSections: { section: true },
};

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

  findFiltered(
    where: FindOptionsWhere<Class>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Class>> {
    return this.findPage(
      {
        where,
        relations: SECTION_RELATIONS,
        order: { level: 'ASC', name: 'ASC' },
      },
      page,
    );
  }
}
