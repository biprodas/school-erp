import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentStatusHistory } from '../entities/student-status-history.entity';

@Injectable()
export class StudentStatusHistoryRepository extends BaseTenantRepository<StudentStatusHistory> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentStatusHistory, 'StudentStatusHistory');
  }

  findByStudent(studentId: string): Promise<StudentStatusHistory[]> {
    return this.repo.find({
      where: { studentId },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }
}
