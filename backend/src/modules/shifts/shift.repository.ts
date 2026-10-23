import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Shift } from './entities/shift.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class ShiftRepository extends BaseTenantRepository<Shift> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Shift, 'Shift');
  }

  findByName(name: string): Promise<Shift | null> {
    return this.repo.findOne({ where: { name } });
  }

  findFiltered(
    where: FindOptionsWhere<Shift>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Shift>> {
    return this.findPage(
      { where, order: { sortOrder: 'ASC', startTime: 'ASC' } },
      page,
    );
  }
}
