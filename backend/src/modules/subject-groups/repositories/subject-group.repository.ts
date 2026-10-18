import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { SubjectGroup } from '../entities/subject-group.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class SubjectGroupRepository extends BaseTenantRepository<SubjectGroup> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, SubjectGroup, 'SubjectGroup');
  }

  findByName(name: string): Promise<SubjectGroup | null> {
    return this.repo.findOne({ where: { name } });
  }

  findByIdWithSubjects(id: string): Promise<SubjectGroup | null> {
    return this.repo.findOne({
      where: { id },
      relations: { subjectLinks: { subject: true } },
    });
  }

  findFiltered(
    where: FindOptionsWhere<SubjectGroup>,
    page: PaginationQueryDto,
  ): Promise<Paginated<SubjectGroup>> {
    return this.findPage({ where, order: { name: 'ASC' } }, page);
  }
}
