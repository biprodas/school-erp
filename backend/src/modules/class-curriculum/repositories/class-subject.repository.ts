import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassSubject } from '../entities/class-subject.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<ClassSubject> = {
  schoolClass: true,
  subject: true,
  academicYear: true,
  subjectGroup: true,
  components: true,
};

@Injectable()
export class ClassSubjectRepository extends BaseTenantRepository<ClassSubject> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassSubject, 'ClassSubject');
  }

  findByIdWithRelations(id: string): Promise<ClassSubject | null> {
    return this.repo.findOne({
      where: { id },
      relations: RELATIONS,
      order: { components: { sortOrder: 'ASC' } },
    });
  }

  findLink(
    classId: string,
    subjectId: string,
    academicYearId: string,
  ): Promise<ClassSubject | null> {
    return this.repo.findOne({
      where: { classId, subjectId, academicYearId },
    });
  }

  /** Subject ids offered to a class for a year — used to validate electives. */
  async findOfferedSubjectIds(
    classId: string,
    academicYearId: string,
  ): Promise<string[]> {
    const rows = await this.repo.find({
      where: { classId, academicYearId },
      select: { subjectId: true },
    });
    return rows.map((r) => r.subjectId);
  }

  /** Every class subject of a session, with its components. */
  findInYear(academicYearId: string): Promise<ClassSubject[]> {
    return this.repo.find({
      where: { academicYearId },
      relations: { components: true },
    });
  }

  countInYear(academicYearId: string): Promise<number> {
    return this.repo.count({ where: { academicYearId } });
  }

  /** Writes columns only (loaded relations would win over changed ids). */
  async updateFields(
    id: string,
    patch: Partial<
      Pick<
        ClassSubject,
        | 'subjectType'
        | 'subjectGroupId'
        | 'weeklyClasses'
        | 'passMarks'
        | 'fullMarks'
      >
    >,
  ): Promise<void> {
    if (Object.values(patch).every((v) => v === undefined)) return;
    await this.repo.update({ id }, patch);
  }

  async findFiltered(
    where: FindOptionsWhere<ClassSubject>,
    page: PaginationQueryDto,
  ): Promise<Paginated<ClassSubject>> {
    const result = await this.findPage(
      {
        where,
        relations: RELATIONS,
        // `id` breaks ties: rows made in one transaction share created_at,
        // and paging needs a total order. Ordering by a to-many relation
        // here would break TypeORM's paging, so components sort below.
        order: { createdAt: 'DESC', id: 'ASC' },
      },
      page,
    );
    for (const cs of result.items) {
      cs.components?.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return result;
  }
}
