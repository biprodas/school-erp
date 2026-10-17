import { Inject, Injectable } from '@nestjs/common';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { StudentEmergencyContact } from '../entities/student-emergency-contact.entity';

@Injectable()
export class StudentEmergencyContactRepository extends BaseTenantRepository<StudentEmergencyContact> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentEmergencyContact, 'StudentEmergencyContact');
  }

  findByStudent(studentId: string): Promise<StudentEmergencyContact[]> {
    return this.repo.find({
      where: { studentId },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }
}
