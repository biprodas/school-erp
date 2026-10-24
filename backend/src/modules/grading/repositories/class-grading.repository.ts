import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ClassGrading } from '../entities/class-grading.entity';

@Injectable()
export class ClassGradingRepository extends BaseTenantRepository<ClassGrading> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ClassGrading, 'ClassGrading');
  }

  findFor(academicYearId: string, classId: string) {
    return this.repo.findOne({ where: { academicYearId, classId } });
  }

  findInYear(academicYearId?: string): Promise<ClassGrading[]> {
    return this.repo.find({
      where: { academicYearId },
      relations: { schoolClass: true, gradingSystem: true },
      order: { createdAt: 'ASC' },
    });
  }
}
