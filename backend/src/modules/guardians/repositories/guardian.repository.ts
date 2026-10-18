import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Guardian } from '../entities/guardian.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class GuardianRepository extends BaseTenantRepository<Guardian> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Guardian, 'Guardian');
  }

  findByIdWithUser(id: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  findByUserId(userId: string): Promise<Guardian | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findFiltered(
    where: FindOptionsWhere<Guardian>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Guardian>> {
    return this.findPage(
      {
        where,
        relations: { user: true },
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
