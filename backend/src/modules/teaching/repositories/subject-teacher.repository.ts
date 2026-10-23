import { Inject, Injectable } from '@nestjs/common';
import {
  FindOptionsRelations,
  FindOptionsWhere,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { SubjectTeacher } from '../entities/subject-teacher.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<SubjectTeacher> = {
  section: { schoolClass: true, academicYear: true },
  classSubject: { subject: true },
  employee: true,
};

/** Rows in effect on `date` (inclusive on both ends). */
const onDate = (
  date: string,
  where: FindOptionsWhere<SubjectTeacher>,
): FindOptionsWhere<SubjectTeacher>[] => [
  { ...where, effectiveFrom: LessThanOrEqual(date), effectiveTo: IsNull() },
  {
    ...where,
    effectiveFrom: LessThanOrEqual(date),
    effectiveTo: MoreThanOrEqual(date),
  },
];

@Injectable()
export class SubjectTeacherRepository extends BaseTenantRepository<SubjectTeacher> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, SubjectTeacher, 'SubjectTeacher');
  }

  findByIdWithRelations(id: string): Promise<SubjectTeacher | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  /** The current row of a teacher for a subject in a section, if any. */
  findCurrent(
    sectionId: string,
    classSubjectId: string,
    employeeId: string,
  ): Promise<SubjectTeacher | null> {
    return this.repo.findOne({
      where: { sectionId, classSubjectId, employeeId, effectiveTo: IsNull() },
    });
  }

  findActiveForEmployee(
    employeeId: string,
    date: string,
  ): Promise<SubjectTeacher[]> {
    return this.repo.find({ where: onDate(date, { employeeId }) });
  }

  /** Who taught a subject in a section on a day. */
  findActiveFor(
    sectionId: string,
    classSubjectId: string,
    date: string,
  ): Promise<SubjectTeacher[]> {
    return this.repo.find({
      where: onDate(date, { sectionId, classSubjectId }),
      relations: { employee: true },
      order: { effectiveFrom: 'ASC' },
    });
  }

  findCurrentInYear(academicYearId: string): Promise<SubjectTeacher[]> {
    return this.repo.find({
      where: { effectiveTo: IsNull(), section: { academicYearId } },
      relations: { employee: true },
    });
  }

  countInYear(academicYearId: string): Promise<number> {
    return this.repo.count({ where: { section: { academicYearId } } });
  }

  async updateFields(
    id: string,
    patch: Partial<
      Pick<SubjectTeacher, 'employeeId' | 'effectiveFrom' | 'effectiveTo'>
    >,
  ): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  findFiltered(
    where: FindOptionsWhere<SubjectTeacher>[],
    page: PaginationQueryDto,
  ): Promise<Paginated<SubjectTeacher>> {
    return this.findPage(
      {
        where,
        relations: RELATIONS,
        order: { effectiveFrom: 'DESC', createdAt: 'DESC', id: 'ASC' },
      },
      page,
    );
  }
}
