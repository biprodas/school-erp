import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { ClassService } from '~/modules/classes/class.service';
import { DOMAIN_EVENTS } from '~/modules/domain-events/domain-events';
import { DomainEventService } from '~/modules/domain-events/domain-event.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import {
  CreateResultDefinitionDto,
  FilterResultDefinitionDto,
} from '../dto/result.dto';
import type { Exam } from '../entities/exam.entity';
import type { MarkSheet } from '../entities/mark-sheet.entity';
import { ResultDefinition } from '../entities/result-definition.entity';
import { FINAL_SHEET_STATUSES, MarkSheetStatus } from '../enums/exam.enum';
import { ExamRepository } from '../repositories/exam.repository';
import { ExamSubjectRepository } from '../repositories/exam-subject.repository';
import { MarkSheetRepository } from '../repositories/mark-sheet.repository';
import { ResultRepository } from '../repositories/result.repository';
import { ResultDefinitionRepository } from '../repositories/result-definition.repository';

export const TABULATION_JOB = 'results-tabulate';

/** Where a definition's results stand. */
export interface DefinitionStatus {
  sheets: number;
  /** Approved or published. */
  approved: number;
  allApproved: boolean;
  /** Tabulated after the last approval, so publishing shows these numbers. */
  current: boolean;
  published: boolean;
}

export type DefinitionView = ResultDefinition & { status: DefinitionStatus };

/**
 * Result definitions (PRD 6.9 tabulation): which exams make up a class's
 * result and with what weights. Each exam gets its own definition per
 * class when it opens; combined session results are made here. Results
 * tabulate (a job) once every mark sheet of the definition is approved,
 * again after a reopen and re-approval, and publish only while current.
 */
@Injectable()
export class ResultDefinitionService {
  constructor(
    private readonly definitionRepo: ResultDefinitionRepository,
    private readonly examRepo: ExamRepository,
    private readonly subjectRepo: ExamSubjectRepository,
    private readonly sheetRepo: MarkSheetRepository,
    private readonly resultRepo: ResultRepository,
    private readonly classes: ClassService,
    private readonly jobs: JobService,
    private readonly events: DomainEventService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  async findFiltered(
    filter: FilterResultDefinitionDto,
  ): Promise<DefinitionView[]> {
    const where: FindOptionsWhere<ResultDefinition> = {
      academicYearId: filter.academicYearId,
      classId: filter.classId,
      examId: filter.examId,
    };
    const rows = await this.definitionRepo.findMany(where);
    const views: DefinitionView[] = [];
    for (const d of rows)
      views.push(Object.assign(d, { status: await this.status(d) }));
    return views;
  }

  async findById(id: string): Promise<DefinitionView> {
    const definition = await this.definitionRepo.findWithRelations(id);
    if (!definition)
      throw new NotFoundException(`Result definition "${id}" not found`);
    return Object.assign(definition, { status: await this.status(definition) });
  }

  /** The exam's own definition for a class (made when the exam opens). */
  async ensureForExam(exam: Exam, classId: string): Promise<ResultDefinition> {
    const existing = await this.definitionRepo.findForExam(exam.id, classId);
    if (existing) return existing;
    const taken = await this.definitionRepo.findByName(
      exam.academicYearId,
      classId,
      exam.name,
    );
    return this.definitionRepo.saveNew({
      academicYearId: exam.academicYearId,
      classId,
      name: taken ? `${exam.name} (${exam.id.slice(0, 8)})` : exam.name,
      items: [{ examId: exam.id, weight: 100 }],
      examId: exam.id,
      computedAt: null,
      publishedAt: null,
      publishedBy: null,
    });
  }

  /** A combined result over exams the class sits in the session. */
  async create(dto: CreateResultDefinitionDto): Promise<DefinitionView> {
    await this.classes.findById(dto.classId);
    const examIds = dto.items.map((i) => i.examId);
    if (new Set(examIds).size !== examIds.length) {
      throw new BadRequestException({
        message: 'Each exam can appear once',
        code: 'DUPLICATE_EXAM',
      });
    }
    const exams = await this.examRepo.findByIds(examIds);
    for (const id of examIds) {
      const exam = exams.find((e) => e.id === id);
      if (!exam || exam.academicYearId !== dto.academicYearId) {
        throw new BadRequestException({
          message: 'Every exam must be of the same session',
          code: 'EXAM_NOT_IN_SESSION',
          examId: id,
        });
      }
      if (!(await this.subjectRepo.classIdsOf(id)).includes(dto.classId)) {
        throw new BadRequestException({
          message: 'The class does not sit one of the exams',
          code: 'EXAM_NOT_FOR_CLASS',
          examId: id,
        });
      }
    }
    if (
      await this.definitionRepo.findByName(
        dto.academicYearId,
        dto.classId,
        dto.name,
      )
    ) {
      throw new ConflictException({
        message: `The class already has a result called "${dto.name}"`,
        code: 'RESULT_DEFINITION_EXISTS',
      });
    }
    const saved = await this.definitionRepo.saveNew({
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      name: dto.name,
      items: dto.items.map((i) => ({ examId: i.examId, weight: i.weight })),
      examId: null,
      computedAt: null,
      publishedAt: null,
      publishedBy: null,
    });
    return this.findById(saved.id);
  }

  /** Combined definitions only, while unpublished. */
  async remove(id: string): Promise<void> {
    const definition = await this.findById(id);
    if (definition.examId) {
      throw new ConflictException({
        message: "An exam's own result goes with the exam",
        code: 'RESULT_DEFINITION_IMPLICIT',
      });
    }
    if (definition.status.published) {
      throw new ConflictException({
        message: 'Published results can’t be deleted',
        code: 'RESULTS_PUBLISHED',
      });
    }
    await this.definitionRepo.deleteById(id);
  }

  /** The mark sheets a definition's results come from. */
  async sheetsOf(definition: ResultDefinition): Promise<MarkSheet[]> {
    const subjects = await this.subjectRepo.findForExams(
      definition.items.map((i) => i.examId),
      definition.classId,
    );
    return this.sheetRepo.findForExamSubjects(subjects.map((s) => s.id));
  }

  async status(definition: ResultDefinition): Promise<DefinitionStatus> {
    const sheets = await this.sheetsOf(definition);
    const approved = sheets.filter((s) =>
      FINAL_SHEET_STATUSES.includes(s.status),
    );
    const allApproved = sheets.length > 0 && approved.length === sheets.length;
    const lastApproval = Math.max(
      0,
      ...approved.map((s) => s.approvedAt?.getTime() ?? 0),
    );
    const current =
      allApproved &&
      !!definition.computedAt &&
      definition.computedAt.getTime() >= lastApproval;
    return {
      sheets: sheets.length,
      approved: approved.length,
      allApproved,
      current,
      published: !!definition.publishedAt,
    };
  }

  /**
   * After sheets of these exams and classes were approved: queues a
   * tabulation for every definition they complete.
   */
  async afterSheetsChanged(pairs: { examId: string; classId: string }[]) {
    const seen = new Set<string>();
    for (const { examId, classId } of pairs) {
      const exam = await this.examRepo.findById(examId);
      if (!exam) continue;
      const definitions = (
        await this.definitionRepo.findMany({
          academicYearId: exam.academicYearId,
          classId,
        })
      ).filter((d) => d.items.some((i) => i.examId === examId));
      for (const d of definitions) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        const status = await this.status(d);
        if (status.allApproved && !status.current)
          await this.queueTabulation(d.id);
      }
    }
  }

  /** `POST /result-definitions/:id/tabulate`: once every sheet is approved. */
  async startTabulation(id: string): Promise<Job> {
    const definition = await this.findById(id);
    if (!definition.status.allApproved) {
      throw new ConflictException({
        message: 'Every mark sheet must be approved first',
        code: 'SHEETS_NOT_APPROVED',
        sheets: definition.status.sheets,
        approved: definition.status.approved,
      });
    }
    return this.queueTabulation(id);
  }

  /** Publishes current results (portal, guardians notified from M7). */
  publish(id: string): Promise<DefinitionView> {
    return this.ds.runInTransaction(async () => {
      const definition = await this.findById(id);
      if (!definition.status.current) {
        throw new ConflictException({
          message: 'Results are not current: approve every sheet and tabulate',
          code: 'RESULTS_NOT_CURRENT',
        });
      }
      const now = new Date();
      const userId = this.context.current().userId;
      await this.definitionRepo.updateFields(id, {
        publishedAt: now,
        publishedBy: userId,
      });
      await this.resultRepo.publishAll(id, now);
      await this.sheetRepo.updateMany(
        (await this.sheetsOf(definition)).map((s) => s.id),
        { status: MarkSheetStatus.PUBLISHED, publishedAt: now },
      );
      const results = await this.resultRepo.findLight(id);
      await this.audit.record({
        action: AUDIT_ACTIONS.RESULTS_PUBLISHED,
        entityType: 'result_definition',
        entityId: id,
        after: { students: results.length },
      });
      await this.events.record(DOMAIN_EVENTS.RESULTS_PUBLISHED, {
        resultDefinitionId: id,
        resultName: definition.name,
        academicYearId: definition.academicYearId,
        classId: definition.classId,
        enrollmentIds: results.map((r) => r.enrollmentId),
      });
      return this.findById(id);
    });
  }

  private queueTabulation(id: string): Promise<Job> {
    return this.jobs.start<{ resultDefinitionId: string }>({
      type: 'results.tabulate',
      queue: QUEUES.academic,
      name: TABULATION_JOB,
      data: { resultDefinitionId: id },
      options: { attempts: 1 },
    });
  }
}
