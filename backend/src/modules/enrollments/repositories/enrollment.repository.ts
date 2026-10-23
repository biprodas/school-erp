import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentEnrollment } from '../entities/student-enrollment.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<StudentEnrollment> = {
  student: true,
  academicYear: true,
  schoolClass: true,
  section: true,
  subjectGroup: true,
  subjects: { subject: true },
};

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

  /** Writes columns only (loaded relations would win over changed ids). */
  async updateFields(
    id: string,
    patch: Partial<
      Pick<
        StudentEnrollment,
        'classId' | 'sectionId' | 'subjectGroupId' | 'rollNo' | 'status'
      >
    >,
  ): Promise<void> {
    if (Object.values(patch).every((v) => v === undefined)) return;
    await this.repo.update({ id }, patch);
  }

  findFiltered(
    where: FindOptionsWhere<StudentEnrollment>,
    page: PaginationQueryDto,
  ): Promise<Paginated<StudentEnrollment>> {
    return this.findPage(
      {
        where,
        relations: {
          student: true,
          academicYear: true,
          schoolClass: true,
          section: true,
        },
        order: { createdAt: 'DESC' },
      },
      page,
    );
  }
}
