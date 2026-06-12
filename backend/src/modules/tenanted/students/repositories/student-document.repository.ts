import { Inject, Injectable } from '@nestjs/common';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { StudentDocument } from '../entities/student-document.entity';

@Injectable()
export class StudentDocumentRepository extends BaseTenantRepository<StudentDocument> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentDocument, 'StudentDocument');
  }

  findByStudent(studentId: string): Promise<StudentDocument[]> {
    return this.repo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }
}
