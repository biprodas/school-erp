import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { PromotionBatchItem } from '../entities/promotion-batch-item.entity';

@Injectable()
export class PromotionBatchItemRepository extends BaseTenantRepository<PromotionBatchItem> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, PromotionBatchItem, 'PromotionBatchItem');
  }

  /** The batch's items with student and placements, for the preview. */
  findByBatch(batchId: string): Promise<PromotionBatchItem[]> {
    return this.repo.find({
      where: { batchId },
      relations: {
        student: true,
        enrollment: { section: true },
        toClass: true,
        toSection: true,
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async updateFields(
    id: string,
    patch: Partial<
      Pick<
        PromotionBatchItem,
        | 'outcome'
        | 'toClassId'
        | 'toSectionId'
        | 'newRoll'
        | 'overridden'
        | 'note'
        | 'newEnrollmentId'
        | 'previousStatus'
      >
    >,
  ): Promise<void> {
    await this.repo.update({ id }, patch);
  }
}
