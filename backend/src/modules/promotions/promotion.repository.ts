import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentPromotion } from './entities/student-promotion.entity';

const RELATIONS = [
  'student',
  'fromYear',
  'toYear',
  'fromClass',
  'toClass',
  'fromSection',
  'toSection',
];

@Injectable()
export class PromotionRepository extends BaseTenantRepository<StudentPromotion> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentPromotion, 'StudentPromotion');
  }

  findByIdWithRelations(id: string): Promise<StudentPromotion | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findFiltered(where: Record<string, any>): Promise<StudentPromotion[]> {
    return this.repo.find({
      where,
      relations: ['student', 'fromYear', 'toYear', 'fromClass', 'toClass'],
      order: { createdAt: 'DESC' },
    });
  }
}
