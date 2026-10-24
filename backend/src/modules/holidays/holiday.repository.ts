import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { Holiday } from './entities/holiday.entity';

@Injectable()
export class HolidayRepository extends BaseTenantRepository<Holiday> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Holiday, 'Holiday');
  }

  findByNameAndStart(name: string, dateFrom: string): Promise<Holiday | null> {
    return this.repo.findOne({ where: { name, dateFrom } });
  }

  /** Holidays overlapping `[from, to]` (inclusive), earliest first. */
  findOverlapping(from: string, to: string): Promise<Holiday[]> {
    return this.repo.find({
      where: { dateFrom: LessThanOrEqual(to), dateTo: MoreThanOrEqual(from) },
      order: { dateFrom: 'ASC', name: 'ASC' },
    });
  }

  findFiltered(
    where: FindOptionsWhere<Holiday>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Holiday>> {
    return this.findPage(
      { where, order: { dateFrom: 'ASC', name: 'ASC' } },
      page,
    );
  }
}
