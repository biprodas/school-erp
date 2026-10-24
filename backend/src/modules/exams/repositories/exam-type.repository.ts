import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { ExamType } from '../entities/exam-type.entity';

@Injectable()
export class ExamTypeRepository extends BaseTenantRepository<ExamType> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ExamType, 'ExamType');
  }

  findAllOrdered(): Promise<ExamType[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  findByName(name: string): Promise<ExamType | null> {
    return this.repo.findOne({ where: { name } });
  }
}
