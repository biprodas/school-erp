import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Term } from './entities/term.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class TermRepository extends BaseTenantRepository<Term> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Term, 'Term');
  }

  findByName(academicYearId: string, name: string): Promise<Term | null> {
    return this.repo.findOne({ where: { academicYearId, name } });
  }

  findFiltered(
    where: FindOptionsWhere<Term>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Term>> {
    return this.findPage(
      { where, order: { sortOrder: 'ASC', startDate: 'ASC' } },
      page,
    );
  }
}
