import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { FindOptionsWhere } from 'typeorm';
import { ResultDefinition } from '../entities/result-definition.entity';

@Injectable()
export class ResultDefinitionRepository extends BaseTenantRepository<ResultDefinition> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ResultDefinition, 'ResultDefinition');
  }

  findWithRelations(id: string): Promise<ResultDefinition | null> {
    return this.repo.findOne({
      where: { id },
      relations: { schoolClass: true, academicYear: true },
    });
  }

  findMany(where: FindOptionsWhere<ResultDefinition>) {
    return this.repo.find({
      where,
      relations: { schoolClass: true },
      order: { createdAt: 'ASC' },
    });
  }

  findForExam(examId: string, classId: string) {
    return this.repo.findOne({ where: { examId, classId } });
  }

  findByName(academicYearId: string, classId: string, name: string) {
    return this.repo.findOne({ where: { academicYearId, classId, name } });
  }

  async updateFields(id: string, patch: Partial<ResultDefinition>) {
    await this.repo.update({ id }, patch);
  }
}
