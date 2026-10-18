import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Department } from './entities/department.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class DepartmentRepository extends BaseTenantRepository<Department> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Department, 'Department');
  }

  findByName(name: string): Promise<Department | null> {
    return this.repo.findOne({ where: { name } });
  }

  findFiltered(
    where: FindOptionsWhere<Department>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Department>> {
    return this.findPage({ where, order: { createdAt: 'DESC' } }, page);
  }
}
