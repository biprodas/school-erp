import { Inject, Injectable } from '@nestjs/common';
import { Not } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { AcademicYear } from './entities/academic-year.entity';

@Injectable()
export class AcademicYearRepository extends BaseTenantRepository<AcademicYear> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, AcademicYear, 'AcademicYear');
  }

  findByName(name: string): Promise<AcademicYear | null> {
    return this.repo.findOne({ where: { name } });
  }

  findFiltered(where: Record<string, any>): Promise<AcademicYear[]> {
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  /** Clears the current flag on every academic year except the given one. */
  async clearCurrent(exceptId?: string): Promise<void> {
    await this.repo.update(
      exceptId ? { isCurrent: true, id: Not(exceptId) } : { isCurrent: true },
      { isCurrent: false },
    );
  }
}
