import { Inject, Injectable } from '@nestjs/common';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { StudentNote } from '../entities/student-note.entity';

@Injectable()
export class StudentNoteRepository extends BaseTenantRepository<StudentNote> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentNote, 'StudentNote');
  }

  findByStudent(studentId: string): Promise<StudentNote[]> {
    return this.repo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }
}
