import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { DeepPartial, FindOptionsWhere, In, IsNull, Not } from 'typeorm';
import { Result } from '../entities/result.entity';
import { ResultSubject } from '../entities/result-subject.entity';

@Injectable()
export class ResultRepository extends BaseTenantRepository<Result> {
  private readonly subjects: ResultSubjectRepository;

  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Result, 'Result');
    this.subjects = new ResultSubjectRepository(ds);
  }

  findForDefinition(
    resultDefinitionId: string,
    sectionIds?: string[] | null,
  ): Promise<Result[]> {
    const where: FindOptionsWhere<Result> = { resultDefinitionId };
    if (sectionIds) where.sectionId = In(sectionIds);
    return this.repo.find({
      where,
      relations: {
        enrollment: { student: true, section: true },
        subjects: { classSubject: { subject: true } },
      },
      order: { positionClass: 'ASC' },
    });
  }

  findWithRelations(id: string): Promise<Result | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        definition: true,
        enrollment: { student: true, section: true },
        subjects: { classSubject: { subject: true } },
      },
    });
  }

  findLight(resultDefinitionId: string): Promise<Result[]> {
    return this.repo.find({ where: { resultDefinitionId } });
  }

  /** Published results of a student's enrollments (student 360). */
  findPublishedForEnrollments(enrollmentIds: string[]): Promise<Result[]> {
    if (!enrollmentIds.length) return Promise.resolve([]);
    return this.repo.find({
      where: { enrollmentId: In(enrollmentIds), publishedAt: Not(IsNull()) },
      relations: { definition: true },
      order: { computedAt: 'DESC' },
    });
  }

  async insertOne(row: DeepPartial<Result>): Promise<string> {
    const saved = await this.repo.save(this.repo.create(row));
    return saved.id;
  }

  async updateFields(id: string, patch: Partial<Result>): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  async publishAll(resultDefinitionId: string, at: Date): Promise<void> {
    await this.repo.update({ resultDefinitionId }, { publishedAt: at });
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length) await this.repo.delete({ id: In(ids) });
  }

  replaceSubjects(resultId: string, rows: DeepPartial<ResultSubject>[]) {
    return this.subjects.replace(resultId, rows);
  }
}

class ResultSubjectRepository extends BaseTenantRepository<ResultSubject> {
  constructor(ds: TenantDataSourceProxy) {
    super(ds, ResultSubject, 'ResultSubject');
  }

  async replace(resultId: string, rows: DeepPartial<ResultSubject>[]) {
    await this.repo.delete({ resultId });
    if (rows.length) {
      await this.repo.insert(rows.map((r) => ({ ...r, resultId })));
    }
  }
}
