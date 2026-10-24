import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { AttendanceStatus } from '../entities/attendance-status.entity';

@Injectable()
export class AttendanceStatusRepository extends BaseTenantRepository<AttendanceStatus> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, AttendanceStatus, 'AttendanceStatus');
  }

  findAllOrdered(): Promise<AttendanceStatus[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  findByCode(code: string): Promise<AttendanceStatus | null> {
    return this.repo.findOne({ where: { code } });
  }
}
