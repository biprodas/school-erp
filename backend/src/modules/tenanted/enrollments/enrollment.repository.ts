import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentEnrollment } from './entities/student-enrollment.entity';

const RELATIONS = [
  'student',
  'academicYear',
  'schoolClass',
  'section',
  'subjects',
  'subjects.subject',
];

@Injectable()
export class EnrollmentRepository extends BaseTenantRepository<StudentEnrollment> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentEnrollment, 'StudentEnrollment');
  }

  findByIdWithRelations(id: string): Promise<StudentEnrollment | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findForStudentYear(
    studentId: string,
    academicYearId: string,
  ): Promise<StudentEnrollment | null> {
    return this.repo.findOne({ where: { studentId, academicYearId } });
  }

  findFiltered(where: Record<string, any>): Promise<StudentEnrollment[]> {
    return this.repo.find({
      where,
      relations: ['student', 'academicYear', 'schoolClass', 'section'],
      order: { createdAt: 'DESC' },
    });
  }
}
