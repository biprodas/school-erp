import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Stakeholder } from './entities/stakeholder.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class StakeholderRepository extends BaseTenantRepository<Stakeholder> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Stakeholder, 'Stakeholder');
  }

  findByIdWithUser(id: string): Promise<Stakeholder | null> {
    return this.repo.findOne({ where: { id }, relations: ['user'] });
  }

  findByUserId(userId: string): Promise<Stakeholder | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findFiltered(
    where: Record<string, any>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Stakeholder>> {
    return this.findPage(
      {
        where,
        relations: ['user'],
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
