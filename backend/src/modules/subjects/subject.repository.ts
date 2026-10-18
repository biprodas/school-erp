import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Subject } from './entities/subject.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class SubjectRepository extends BaseTenantRepository<Subject> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Subject, 'Subject');
  }

  findByName(name: string): Promise<Subject | null> {
    return this.repo.findOne({ where: { name } });
  }

  findByCode(code: string): Promise<Subject | null> {
    return this.repo.findOne({ where: { code } });
  }

  findByIds(ids: string[]): Promise<Subject[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids) } });
  }

  findFiltered(
    where: Record<string, any>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Subject>> {
    return this.findPage({ where, order: { name: 'ASC' } }, page);
  }
}
