import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentPromotion } from './entities/student-promotion.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<StudentPromotion> = {
  student: true,
  fromYear: true,
  toYear: true,
  fromClass: true,
  toClass: true,
  fromSection: true,
  toSection: true,
};

@Injectable()
export class PromotionRepository extends BaseTenantRepository<StudentPromotion> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentPromotion, 'StudentPromotion');
  }

  findByIdWithRelations(id: string): Promise<StudentPromotion | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findFiltered(
    where: FindOptionsWhere<StudentPromotion>,
    page: PaginationQueryDto,
  ): Promise<Paginated<StudentPromotion>> {
    return this.findPage(
      {
        where,
        relations: {
          student: true,
          fromYear: true,
          toYear: true,
          fromClass: true,
          toClass: true,
        },
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
