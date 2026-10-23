import { Inject, Injectable } from '@nestjs/common';
import {
  FindOptionsRelations,
  FindOptionsWhere,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<ClassTeacher> = {
  section: { schoolClass: true, academicYear: true },
  employee: true,
};

/** Rows in effect on `date` (inclusive on both ends). */
const onDate = (
  date: string,
  where: FindOptionsWhere<ClassTeacher>,
): FindOptionsWhere<ClassTeacher>[] => [
  { ...where, effectiveFrom: LessThanOrEqual(date), effectiveTo: IsNull() },
  {
    ...where,
    effectiveFrom: LessThanOrEqual(date),
    effectiveTo: MoreThanOrEqual(date),
  },
];

@Injectable()
export class ClassTeacherRepository extends BaseTenantRepository<ClassTeacher> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassTeacher, 'ClassTeacher');
  }

  findByIdWithRelations(id: string): Promise<ClassTeacher | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  /** The current row of a teacher in a section, if any. */
  findCurrent(
    sectionId: string,
    employeeId: string,
  ): Promise<ClassTeacher | null> {
    return this.repo.findOne({
      where: { sectionId, employeeId, effectiveTo: IsNull() },
    });
  }

  findCurrentPrimary(sectionId: string): Promise<ClassTeacher | null> {
    return this.repo.findOne({
      where: { sectionId, isPrimary: true, effectiveTo: IsNull() },
    });
  }

  /** Clears the primary flag on the section's other current teachers. */
  async clearPrimary(sectionId: string, exceptId?: string): Promise<void> {
    await this.repo.update(
      {
        sectionId,
        isPrimary: true,
        effectiveTo: IsNull(),
        id: exceptId ? Not(exceptId) : undefined,
      },
      { isPrimary: false },
    );
  }

  /** An employee's rows in effect on a day. */
  findActiveForEmployee(
    employeeId: string,
    date: string,
  ): Promise<ClassTeacher[]> {
    return this.repo.find({ where: onDate(date, { employeeId }) });
  }

  /** A section's class teachers on a day. */
  findActiveInSection(
    sectionId: string,
    date: string,
  ): Promise<ClassTeacher[]> {
    return this.repo.find({
      where: onDate(date, { sectionId }),
      relations: { employee: true },
    });
  }

  /** Current rows in the sections of a session, with their employee. */
  findCurrentInYear(academicYearId: string): Promise<ClassTeacher[]> {
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
      Pick<
        ClassTeacher,
        'employeeId' | 'isPrimary' | 'effectiveFrom' | 'effectiveTo'
      >
    >,
  ): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  findFiltered(
    where: FindOptionsWhere<ClassTeacher>[],
    page: PaginationQueryDto,
  ): Promise<Paginated<ClassTeacher>> {
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
