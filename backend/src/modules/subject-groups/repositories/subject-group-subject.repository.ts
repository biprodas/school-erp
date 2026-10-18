import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { SubjectGroupSubject } from '../entities/subject-group-subject.entity';

@Injectable()
export class SubjectGroupSubjectRepository extends BaseTenantRepository<SubjectGroupSubject> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, SubjectGroupSubject, 'SubjectGroupSubject');
  }

  findByGroup(subjectGroupId: string): Promise<SubjectGroupSubject[]> {
    return this.repo.find({
      where: { subjectGroupId },
      relations: ['subject'],
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  findLink(
    subjectGroupId: string,
    subjectId: string,
  ): Promise<SubjectGroupSubject | null> {
    return this.repo.findOne({ where: { subjectGroupId, subjectId } });
  }

  findByIdWithSubject(id: string): Promise<SubjectGroupSubject | null> {
    return this.repo.findOne({ where: { id }, relations: ['subject'] });
  }
}
