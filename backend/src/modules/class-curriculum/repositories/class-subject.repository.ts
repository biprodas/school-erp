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
};

@Injectable()
export class ClassSubjectRepository extends BaseTenantRepository<ClassSubject> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassSubject, 'ClassSubject');
  }

  findByIdWithRelations(id: string): Promise<ClassSubject | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
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

  findFiltered(
    where: FindOptionsWhere<ClassSubject>,
    page: PaginationQueryDto,
  ): Promise<Paginated<ClassSubject>> {
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
