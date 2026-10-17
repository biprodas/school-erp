import { Inject, Injectable } from '@nestjs/common';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { StudentMedicalRecord } from '../entities/student-medical-record.entity';

@Injectable()
export class StudentMedicalRecordRepository extends BaseTenantRepository<StudentMedicalRecord> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentMedicalRecord, 'StudentMedicalRecord');
  }

  findByStudent(studentId: string): Promise<StudentMedicalRecord | null> {
    return this.repo.findOne({ where: { studentId } });
  }
}
