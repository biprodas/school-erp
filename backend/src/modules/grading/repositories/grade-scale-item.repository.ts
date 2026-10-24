import { Inject, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { GradeScaleItem } from '../entities/grade-scale-item.entity';

@Injectable()
export class GradeScaleItemRepository extends BaseTenantRepository<GradeScaleItem> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, GradeScaleItem, 'GradeScaleItem');
  }

  /** Replaces a system's whole scale. */
  async replace(
    gradingSystemId: string,
    items: DeepPartial<GradeScaleItem>[],
  ): Promise<void> {
    await this.repo.delete({ gradingSystemId });
    await this.repo.insert(items.map((i) => ({ ...i, gradingSystemId })));
  }
}
