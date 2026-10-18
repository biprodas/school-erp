import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentSubject } from '../entities/student-subject.entity';

@Injectable()
export class StudentSubjectRepository extends BaseTenantRepository<StudentSubject> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentSubject, 'StudentSubject');
  }

  findByEnrollment(enrollmentId: string): Promise<StudentSubject[]> {
    return this.repo.find({
      where: { studentEnrollmentId: enrollmentId },
      relations: { subject: true },
      order: { createdAt: 'ASC' },
    });
  }

  findLink(
    studentEnrollmentId: string,
    subjectId: string,
  ): Promise<StudentSubject | null> {
    return this.repo.findOne({ where: { studentEnrollmentId, subjectId } });
  }

  findByIdWithSubject(id: string): Promise<StudentSubject | null> {
    return this.repo.findOne({ where: { id }, relations: { subject: true } });
  }
}
