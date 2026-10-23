import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { PromotionBatch } from '../entities/promotion-batch.entity';
import { PromotionBatchStatus } from '../enums/promotion.enum';

@Injectable()
export class PromotionBatchRepository extends BaseTenantRepository<PromotionBatch> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, PromotionBatch, 'PromotionBatch');
  }

  /** The draft or committed batch of a class and session, if any. */
  findLive(
    fromYearId: string,
    classId: string,
  ): Promise<PromotionBatch | null> {
    return this.repo.findOne({
      where: {
        fromYearId,
        classId,
        status: In([
          PromotionBatchStatus.DRAFT,
          PromotionBatchStatus.COMMITTED,
        ]),
      },
    });
  }

  async updateFields(
    id: string,
    patch: Partial<
      Omit<PromotionBatch, 'items' | 'fromYear' | 'toYear' | 'schoolClass'>
    >,
  ): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  findFiltered(
    where: FindOptionsWhere<PromotionBatch>,
    page: PaginationQueryDto,
  ): Promise<Paginated<PromotionBatch>> {
    return this.findPage(
      {
        where,
        relations: { fromYear: true, toYear: true, schoolClass: true },
        order: { createdAt: 'DESC', id: 'ASC' },
      },
      page,
    );
  }
}
