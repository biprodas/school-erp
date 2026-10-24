import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { FindOptionsWhere, In } from 'typeorm';
import { MarkSheet } from '../entities/mark-sheet.entity';

@Injectable()
export class MarkSheetRepository extends BaseTenantRepository<MarkSheet> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, MarkSheet, 'MarkSheet');
  }

  findWithRelations(id: string, lock = false): Promise<MarkSheet | null> {
    if (lock) {
      // Row lock first (FOR UPDATE can't join the nullable relations).
      return this.repo
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
        .then((sheet) => (sheet ? this.findWithRelations(id) : null));
    }
    return this.repo.findOne({
      where: { id },
      relations: {
        examSubject: {
          exam: true,
          components: true,
          classSubject: { subject: true },
        },
        section: { schoolClass: true },
      },
      order: { examSubject: { components: { sortOrder: 'ASC' } } },
    });
  }

  findMany(where: FindOptionsWhere<MarkSheet>): Promise<MarkSheet[]> {
    return this.repo.find({
      where,
      relations: {
        examSubject: { classSubject: { subject: true } },
        section: true,
      },
      order: { examSubject: { sortOrder: 'ASC' }, createdAt: 'ASC' },
    });
  }

  /** The sheets of some exam subjects (all sections). */
  findForExamSubjects(examSubjectIds: string[]): Promise<MarkSheet[]> {
    if (!examSubjectIds.length) return Promise.resolve([]);
    return this.repo.find({ where: { examSubjectId: In(examSubjectIds) } });
  }

  /** Creates the missing sheets (idempotent). */
  async ensure(pairs: { examSubjectId: string; sectionId: string }[]) {
    if (!pairs.length) return;
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(MarkSheet)
      .values(pairs.map((p) => ({ ...p, orgId: this.orgId })))
      .orIgnore()
      .execute();
  }

  async updateFields(id: string, patch: Partial<MarkSheet>): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  async updateMany(ids: string[], patch: Partial<MarkSheet>): Promise<void> {
    if (ids.length) await this.repo.update({ id: In(ids) }, patch);
  }
}
