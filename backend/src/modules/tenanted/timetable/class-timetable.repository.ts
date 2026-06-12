import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassTimetable } from './entities/class-timetable.entity';
import { DayOfWeek } from './enums/day-of-week.enum';

const RELATIONS = [
  'academicYear',
  'schoolClass',
  'section',
  'period',
  'subject',
  'employee',
];

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

  findFiltered(where: Record<string, any>): Promise<ClassTimetable[]> {
    return this.repo.find({
      where,
      relations: RELATIONS,
      order: { dayOfWeek: 'ASC', createdAt: 'ASC' },
    });
  }
}
