import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { EnrollmentChange } from '../entities/enrollment-change.entity';

@Injectable()
export class EnrollmentChangeRepository extends BaseTenantRepository<EnrollmentChange> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, EnrollmentChange, 'EnrollmentChange');
  }

  findByEnrollment(enrollmentId: string): Promise<EnrollmentChange[]> {
    return this.repo.find({
      where: { enrollmentId },
      relations: { fromSection: true, toSection: true },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  countForEnrollments(enrollmentIds: string[]): Promise<number> {
    if (!enrollmentIds.length) return Promise.resolve(0);
    return this.repo.count({ where: { enrollmentId: In(enrollmentIds) } });
  }
}
