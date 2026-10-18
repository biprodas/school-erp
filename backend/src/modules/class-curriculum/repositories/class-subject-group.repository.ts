import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassSubjectGroup } from '../entities/class-subject-group.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS = ['schoolClass', 'subjectGroup', 'academicYear'];

@Injectable()
export class ClassSubjectGroupRepository extends BaseTenantRepository<ClassSubjectGroup> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassSubjectGroup, 'ClassSubjectGroup');
  }

  findByIdWithRelations(id: string): Promise<ClassSubjectGroup | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findLink(
    classId: string,
    subjectGroupId: string,
    academicYearId: string,
  ): Promise<ClassSubjectGroup | null> {
    return this.repo.findOne({
      where: { classId, subjectGroupId, academicYearId },
    });
  }

  findFiltered(
    where: Record<string, any>,
    page: PaginationQueryDto,
  ): Promise<Paginated<ClassSubjectGroup>> {
    return this.findPage(
      {
        where,
        relations: RELATIONS,
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
