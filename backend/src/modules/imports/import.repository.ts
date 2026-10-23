import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { ImportBatch } from './entities/import.entity';

@Injectable()
export class ImportRepository extends BaseTenantRepository<ImportBatch> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ImportBatch, 'ImportBatch');
  }

  async updateFields(
    id: string,
    patch: Partial<Omit<ImportBatch, 'file'>>,
  ): Promise<void> {
    await this.repo.update({ id }, patch as never);
  }

  /** The list without the (large) row payloads. */
  findFiltered(
    where: FindOptionsWhere<ImportBatch>,
    page: PaginationQueryDto,
  ): Promise<Paginated<ImportBatch>> {
    return this.findPage(
      {
        where,
        select: {
          id: true,
          type: true,
          status: true,
          mode: true,
          academicYearId: true,
          totals: true,
          failure: true,
          createdBy: true,
          committedAt: true,
          createdAt: true,
        },
        order: { createdAt: 'DESC', id: 'ASC' },
      },
      page,
    );
  }
}
