import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { SubjectTeacher } from '../entities/subject-teacher.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<SubjectTeacher> = {
  schoolClass: true,
  section: true,
  subject: true,
  employee: true,
  academicYear: true,
};

@Injectable()
export class SubjectTeacherRepository extends BaseTenantRepository<SubjectTeacher> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, SubjectTeacher, 'SubjectTeacher');
  }

  findByIdWithRelations(id: string): Promise<SubjectTeacher | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findLink(
    academicYearId: string,
    classId: string,
    sectionId: string,
    subjectId: string,
    employeeId: string,
  ): Promise<SubjectTeacher | null> {
    return this.repo.findOne({
      where: { academicYearId, classId, sectionId, subjectId, employeeId },
    });
  }

  findFiltered(
    where: FindOptionsWhere<SubjectTeacher>,
    page: PaginationQueryDto,
  ): Promise<Paginated<SubjectTeacher>> {
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
