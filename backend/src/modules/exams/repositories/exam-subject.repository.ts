import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { DeepPartial, In } from 'typeorm';
import { ExamSubjectComponent } from '../entities/exam-subject-component.entity';
import { ExamSubject } from '../entities/exam-subject.entity';

const RELATIONS = {
  components: true,
  classSubject: { subject: true },
} as const;
const ORDER = {
  sortOrder: 'ASC',
  createdAt: 'ASC',
  components: { sortOrder: 'ASC' },
} as const;

@Injectable()
export class ExamSubjectRepository extends BaseTenantRepository<ExamSubject> {
  private readonly components: ComponentRepository;

  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ExamSubject, 'ExamSubject');
    this.components = new ComponentRepository(ds);
  }

  findWithComponents(id: string): Promise<ExamSubject | null> {
    return this.repo.findOne({
      where: { id },
      relations: RELATIONS,
      order: ORDER,
    });
  }

  /** An exam's subjects (optionally one class's), with components. */
  findForExam(examId: string, classId?: string): Promise<ExamSubject[]> {
    return this.repo.find({
      where: { examId, classId },
      relations: RELATIONS,
      order: ORDER,
    });
  }

  /** The subjects of several exams for one class (tabulation). */
  findForExams(examIds: string[], classId: string): Promise<ExamSubject[]> {
    if (!examIds.length) return Promise.resolve([]);
    return this.repo.find({
      where: { examId: In(examIds), classId },
      relations: RELATIONS,
      order: ORDER,
    });
  }

  findClassSubjectIds(examId: string): Promise<ExamSubject[]> {
    return this.repo.find({
      where: { examId },
      select: { id: true, classSubjectId: true, classId: true },
    });
  }

  async classIdsOf(examId: string): Promise<string[]> {
    const rows = await this.findClassSubjectIds(examId);
    return [...new Set(rows.map((r) => r.classId))];
  }

  async updateMarks(
    id: string,
    patch: Partial<Pick<ExamSubject, 'fullMarks' | 'passMarks' | 'sortOrder'>>,
  ): Promise<void> {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(defined).length) await this.repo.update({ id }, defined);
  }

  replaceComponents(
    examSubjectId: string,
    rows: DeepPartial<ExamSubjectComponent>[],
  ): Promise<void> {
    return this.components.replace(examSubjectId, rows);
  }
}

class ComponentRepository extends BaseTenantRepository<ExamSubjectComponent> {
  constructor(ds: TenantDataSourceProxy) {
    super(ds, ExamSubjectComponent, 'ExamSubjectComponent');
  }

  async replace(
    examSubjectId: string,
    rows: DeepPartial<ExamSubjectComponent>[],
  ): Promise<void> {
    await this.repo.delete({ examSubjectId });
    if (rows.length) {
      await this.repo.insert(rows.map((r) => ({ ...r, examSubjectId })));
    }
  }
}
