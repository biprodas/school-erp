import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Student } from './entities/student.entity';

@Injectable()
export class StudentRepository extends BaseTenantRepository<Student> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Student, 'Student');
  }

  findByAdmissionNumber(admissionNumber: string): Promise<Student | null> {
    return this.repo.findOne({ where: { admissionNumber } });
  }

  findByUserId(userId: string): Promise<Student | null> {
    return this.repo.findOne({ where: { userId } });
  }

  findFiltered(where: Record<string, any>): Promise<Student[]> {
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
}
