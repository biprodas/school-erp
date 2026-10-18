import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassTimetable } from '../entities/class-timetable.entity';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS: FindOptionsRelations<ClassTimetable> = {
  academicYear: true,
  schoolClass: true,
  section: true,
  period: true,
  subject: true,
  employee: true,
};

@Injectable()
export class ClassTimetableRepository extends BaseTenantRepository<ClassTimetable> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassTimetable, 'ClassTimetable');
  }

  findByIdWithRelations(id: string): Promise<ClassTimetable | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findSlot(
    academicYearId: string,
    classId: string,
    sectionId: string,
    dayOfWeek: DayOfWeek,
    periodId: string,
  ): Promise<ClassTimetable | null> {
    return this.repo.findOne({
      where: { academicYearId, classId, sectionId, dayOfWeek, periodId },
    });
  }

  findFiltered(
    where: FindOptionsWhere<ClassTimetable>,
    page: PaginationQueryDto,
  ): Promise<Paginated<ClassTimetable>> {
    return this.findPage(
      {
        where,
        relations: RELATIONS,
        order: { dayOfWeek: 'ASC', createdAt: 'ASC' },
      },
      page,
    );
  }
}
