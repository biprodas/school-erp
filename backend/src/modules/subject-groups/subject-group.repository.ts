import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { SubjectGroup } from './entities/subject-group.entity';

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
      relations: ['subjectLinks', 'subjectLinks.subject'],
    });
  }

  findFiltered(where: Record<string, any>): Promise<SubjectGroup[]> {
    return this.repo.find({ where, order: { name: 'ASC' } });
  }
}
