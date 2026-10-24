import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { DeepPartial, In } from 'typeorm';
import { Mark } from '../entities/mark.entity';

@Injectable()
export class MarkRepository extends BaseTenantRepository<Mark> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Mark, 'Mark');
  }

  findBySheet(markSheetId: string): Promise<Mark[]> {
    return this.repo.find({ where: { markSheetId } });
  }

  findBySheets(markSheetIds: string[]): Promise<Mark[]> {
    if (!markSheetIds.length) return Promise.resolve([]);
    return this.repo.find({ where: { markSheetId: In(markSheetIds) } });
  }

  async insertMany(rows: DeepPartial<Mark>[]): Promise<void> {
    if (rows.length) await this.repo.insert(rows);
  }

  async updateFields(
    id: string,
    patch: Pick<Mark, 'value' | 'absent' | 'exempt' | 'updatedBy'>,
  ): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  /** Marks entered for any of the exam subjects (edit checks). */
  async countForExamSubjects(examSubjectIds: string[]): Promise<number> {
    if (!examSubjectIds.length) return 0;
    return this.repo.count({
      where: { markSheet: { examSubjectId: In(examSubjectIds) } },
    });
  }

  countForEnrollments(enrollmentIds: string[]): Promise<number> {
    if (!enrollmentIds.length) return Promise.resolve(0);
    return this.repo.count({ where: { enrollmentId: In(enrollmentIds) } });
  }
}
