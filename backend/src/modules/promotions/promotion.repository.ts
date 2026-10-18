import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentPromotion } from './entities/student-promotion.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

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

  findFiltered(
    where: Record<string, any>,
    page: PaginationQueryDto,
  ): Promise<Paginated<StudentPromotion>> {
    return this.findPage(
      {
        where,
        relations: ['student', 'fromYear', 'toYear', 'fromClass', 'toClass'],
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
