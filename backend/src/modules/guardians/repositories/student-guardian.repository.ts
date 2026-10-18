import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { StudentGuardian } from '../entities/student-guardian.entity';

@Injectable()
export class StudentGuardianRepository extends BaseTenantRepository<StudentGuardian> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentGuardian, 'StudentGuardian');
  }

  findByStudent(studentId: string): Promise<StudentGuardian[]> {
    return this.repo.find({
      where: { studentId },
      relations: ['guardian'],
      order: { createdAt: 'ASC' },
    });
  }

  findLink(
    studentId: string,
    guardianId: string,
  ): Promise<StudentGuardian | null> {
    return this.repo.findOne({ where: { studentId, guardianId } });
  }

  /** Clears the primary flag on every guardian link for a student. */
  /** Removes every link of a guardian (when the guardian is deleted). */
  async deleteByGuardian(guardianId: string): Promise<void> {
    await this.repo.delete({ guardianId });
  }

  async clearPrimary(studentId: string): Promise<void> {
    await this.repo.update(
      { studentId, isPrimary: true },
      { isPrimary: false },
    );
  }
}
