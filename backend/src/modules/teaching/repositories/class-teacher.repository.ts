import { Inject, Injectable } from '@nestjs/common';
import { Not } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';

const RELATIONS = ['schoolClass', 'section', 'employee', 'academicYear'];

@Injectable()
export class ClassTeacherRepository extends BaseTenantRepository<ClassTeacher> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassTeacher, 'ClassTeacher');
  }

  findByIdWithRelations(id: string): Promise<ClassTeacher | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findLink(
    academicYearId: string,
    classId: string,
    sectionId: string,
    employeeId: string,
  ): Promise<ClassTeacher | null> {
    return this.repo.findOne({
      where: { academicYearId, classId, sectionId, employeeId },
    });
  }

  /** Clears the primary flag on other teachers of the same year+class+section. */
  async clearPrimary(
    academicYearId: string,
    classId: string,
    sectionId: string,
    exceptId?: string,
  ): Promise<void> {
    await this.repo.update(
      {
        academicYearId,
        classId,
        sectionId,
        isPrimary: true,
        ...(exceptId ? { id: Not(exceptId) } : {}),
      },
      { isPrimary: false },
    );
  }

  findFiltered(
    where: Record<string, any>,
    page: PaginationQueryDto,
  ): Promise<Paginated<ClassTeacher>> {
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
