import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { FindOptionsWhere, In } from 'typeorm';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { Exam } from '../entities/exam.entity';

@Injectable()
export class ExamRepository extends BaseTenantRepository<Exam> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Exam, 'Exam');
  }

  findWithRelations(id: string): Promise<Exam | null> {
    return this.repo.findOne({
      where: { id },
      relations: { academicYear: true, term: true, examType: true },
    });
  }

  findByIds(ids: string[]): Promise<Exam[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids) } });
  }

  findByName(academicYearId: string, name: string): Promise<Exam | null> {
    return this.repo.findOne({ where: { academicYearId, name } });
  }

  findFiltered(
    where: FindOptionsWhere<Exam>,
    page: PaginationQueryDto,
  ): Promise<Paginated<Exam>> {
    return this.findPage(
      {
        where,
        relations: { examType: true, term: true },
        order: { startDate: 'ASC', createdAt: 'ASC' },
      },
      page,
    );
  }

  async updateFields(id: string, patch: Partial<Exam>): Promise<void> {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(defined).length) await this.repo.update({ id }, defined);
  }
}
