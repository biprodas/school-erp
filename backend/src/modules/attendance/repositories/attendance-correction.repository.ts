import { Inject, Injectable } from '@nestjs/common';
import { DeepPartial, In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { AttendanceCorrection } from '../entities/attendance-correction.entity';

@Injectable()
export class AttendanceCorrectionRepository extends BaseTenantRepository<AttendanceCorrection> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, AttendanceCorrection, 'AttendanceCorrection');
  }

  async insertMany(rows: DeepPartial<AttendanceCorrection>[]): Promise<void> {
    if (rows.length) await this.repo.insert(rows);
  }

  /** The corrections of some records, oldest first. */
  findForRecords(recordIds: string[]): Promise<AttendanceCorrection[]> {
    if (!recordIds.length) return Promise.resolve([]);
    return this.repo.find({
      where: { recordId: In(recordIds) },
      order: { changedAt: 'ASC' },
    });
  }
}
