import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere, In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentEnrollment } from '../entities/student-enrollment.entity';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';
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

  /** A student's enrollments, newest session first. */
  findForStudent(studentId: string): Promise<StudentEnrollment[]> {
    return this.repo.find({
      where: { studentId },
      relations: { academicYear: true, schoolClass: true, section: true },
      order: { academicYear: { startDate: 'DESC' }, createdAt: 'DESC' },
    });
  }

  findByRoll(
    sectionId: string,
    rollNo: string,
  ): Promise<StudentEnrollment | null> {
    return this.repo.findOne({ where: { sectionId, rollNo } });
  }

  countActiveInSection(sectionId: string): Promise<number> {
    return this.repo.count({
      where: { sectionId, status: StudentEnrollmentStatus.ACTIVE },
    });
  }

  /** Active enrollments per class in a session, counted in the database. */
  async countActiveByClass(
    academicYearId: string,
  ): Promise<{ classId: string; students: number }[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.classId', 'classId')
      .addSelect('count(*)::int', 'students')
      .where('e.orgId = :orgId', { orgId: this.orgId })
      .andWhere('e.academicYearId = :academicYearId', { academicYearId })
      .andWhere('e.status = :status', {
        status: StudentEnrollmentStatus.ACTIVE,
      })
      .groupBy('e.classId')
      .getRawMany<{ classId: string; students: number }>();
    return rows;
  }

  findActiveInSection(sectionId: string): Promise<StudentEnrollment[]> {
    return this.repo.find({
      where: { sectionId, status: StudentEnrollmentStatus.ACTIVE },
      relations: { student: true },
      order: { rollNo: 'ASC', id: 'ASC' },
    });
  }

  /** Active enrollments of a class in a session, by roll then name. */
  findActiveInClass(
    academicYearId: string,
    classId: string,
  ): Promise<StudentEnrollment[]> {
    return this.repo.find({
      where: {
        academicYearId,
        classId,
        status: StudentEnrollmentStatus.ACTIVE,
      },
      relations: { student: true, section: true },
    });
  }

  /** A class's enrollments in a session with any of the statuses. */
  findInClass(
    academicYearId: string,
    classId: string,
    statuses: StudentEnrollmentStatus[],
  ): Promise<StudentEnrollment[]> {
    return this.repo.find({
      where: { academicYearId, classId, status: In(statuses) },
      relations: { student: true, section: true },
    });
  }

  /** A session's enrollments with any of the statuses (no relations). */
  findInYear(
    academicYearId: string,
    statuses: StudentEnrollmentStatus[],
  ): Promise<StudentEnrollment[]> {
    return this.repo.find({
      where: { academicYearId, status: In(statuses) },
    });
  }

  /** Enrollments by id with student, class and section (reports). */
  findByIds(ids: string[]): Promise<StudentEnrollment[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({
      where: { id: In(ids) },
      relations: { student: true, schoolClass: true, section: true },
    });
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
