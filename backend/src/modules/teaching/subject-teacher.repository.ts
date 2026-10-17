import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { SubjectTeacher } from './entities/subject-teacher.entity';

const RELATIONS = [
  'schoolClass',
  'section',
  'subject',
  'employee',
  'academicYear',
];

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

  findFiltered(where: Record<string, any>): Promise<SubjectTeacher[]> {
    return this.repo.find({
      where,
      relations: RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }
}
