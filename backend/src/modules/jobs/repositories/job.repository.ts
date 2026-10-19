import { Inject, Injectable } from '@nestjs/common';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Job } from '../entities/job.entity';

@Injectable()
export class JobRepository extends BaseTenantRepository<Job> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Job, 'Job');
  }

  async patch(id: string, changes: Partial<Job>): Promise<void> {
    // TypeORM's partial type can't express the jsonb `result` column.
    await this.repo.update(id, changes as QueryDeepPartialEntity<Job>);
  }
}
