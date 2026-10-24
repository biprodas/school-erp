import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import type { ClassSubject } from '~/modules/class-curriculum/entities/class-subject.entity';
import { SubjectComponent } from '~/modules/class-curriculum/enums/subject-component.enum';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { SectionService } from '~/modules/sections/section.service';
import { TermService } from '~/modules/terms/term.service';
import {
  AddExamSubjectsDto,
  CreateExamDto,
  FilterExamDto,
  UpdateExamDto,
  UpdateExamSubjectDto,
} from '../dto/exam.dto';
import type { ExamSubject } from '../entities/exam-subject.entity';
import type { Exam } from '../entities/exam.entity';
import { ExamStatus } from '../enums/exam.enum';
import { ExamRepository } from '../repositories/exam.repository';
import { ExamSubjectRepository } from '../repositories/exam-subject.repository';
import { MarkRepository } from '../repositories/mark.repository';
import { MarkSheetRepository } from '../repositories/mark-sheet.repository';
import { ExamTypeService } from './exam-type.service';
import { ResultDefinitionService } from './result-definition.service';

/**
 * Exams (PRD 6.9 exam setup): an exam of a session, the class subjects it
 * covers with their full and pass marks per component (copied from the
 * class subject, editable per exam until marks exist), and opening it for
 * mark entry, which creates a mark sheet per subject and section and the
 * exam's own result definition per class.
 */
@Injectable()
export class ExamService {
  constructor(
    private readonly examRepo: ExamRepository,
    private readonly subjectRepo: ExamSubjectRepository,
    private readonly sheetRepo: MarkSheetRepository,
    private readonly markRepo: MarkRepository,
    private readonly types: ExamTypeService,
    private readonly definitions: ResultDefinitionService,
    private readonly academicYears: AcademicYearService,
    private readonly terms: TermService,
    private readonly classSubjects: ClassSubjectService,
    private readonly sections: SectionService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(filter: FilterExamDto): Promise<Paginated<Exam>> {
    const where: FindOptionsWhere<Exam> = {};
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.termId) where.termId = filter.termId;
    if (filter.status) where.status = filter.status;
    return this.examRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Exam> {
    const exam = await this.examRepo.findWithRelations(id);
    if (!exam) throw new NotFoundException(`Exam "${id}" not found`);
    return exam;
  }

  async create(dto: CreateExamDto): Promise<Exam> {
    const year = await this.academicYears.findById(dto.academicYearId);
    await this.assertRefs(dto.academicYearId, dto);
    assertDates(year, dto.startDate ?? null, dto.endDate ?? null);
    await this.assertNameFree(dto.academicYearId, dto.name);
    const type = dto.examTypeId
      ? await this.types.findById(dto.examTypeId)
      : null;
    const exam = await this.examRepo.saveNew({
      academicYearId: dto.academicYearId,
      name: dto.name,
      termId: dto.termId ?? null,
      examTypeId: dto.examTypeId ?? null,
      weight: dto.weight ?? type?.defaultWeight ?? 100,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      status: ExamStatus.DRAFT,
    });
    return this.findById(exam.id);
  }

  async update(id: string, dto: UpdateExamDto): Promise<Exam> {
    const exam = await this.findById(id);
    await this.assertRefs(exam.academicYearId, dto);
    assertDates(
      exam.academicYear!,
      dto.startDate !== undefined ? dto.startDate : exam.startDate,
      dto.endDate !== undefined ? dto.endDate : exam.endDate,
    );
    if (dto.name && dto.name !== exam.name) {
      await this.assertNameFree(exam.academicYearId, dto.name);
    }
    await this.examRepo.updateFields(id, { ...dto });
    return this.findById(id);
  }

  /** Only while no marks are entered. */
  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.assertNoMarks(
      (await this.subjectRepo.findClassSubjectIds(id)).map((s) => s.id),
      'EXAM_HAS_MARKS',
    );
    await this.examRepo.deleteById(id);
  }

  /** Exams a class sits that end on or after `today`, soonest first. */
  async upcomingForClass(
    academicYearId: string,
    classId: string,
    today: string,
  ): Promise<Exam[]> {
    const exams = await this.examRepo.find({
      where: { academicYearId },
      order: { startDate: 'ASC' },
    });
    const upcoming: Exam[] = [];
    for (const exam of exams) {
      if (exam.endDate && exam.endDate < today) continue;
      if (!exam.startDate && !exam.endDate) continue;
      if ((await this.subjectRepo.classIdsOf(exam.id)).includes(classId)) {
        upcoming.push(exam);
      }
    }
    return upcoming;
  }

  // --- Subjects ------------------------------------------------------------

  async subjects(examId: string, classId?: string): Promise<ExamSubject[]> {
    await this.findById(examId);
    return this.subjectRepo.findForExam(examId, classId);
  }

  /**
   * Attaches class subjects of the exam's session (every subject of
   * `classIds`, plus `classSubjectIds`), skipping those already in it.
   */
  addSubjects(examId: string, dto: AddExamSubjectsDto): Promise<ExamSubject[]> {
    return this.ds.runInTransaction(async () => {
      const exam = await this.findById(examId);
      const offered = await this.classSubjects.findInYear(exam.academicYearId);
      const wanted = offered.filter(
        (cs) =>
          dto.classIds?.includes(cs.classId) ||
          dto.classSubjectIds?.includes(cs.id),
      );
      const unknown = (dto.classSubjectIds ?? []).filter(
        (id) => !offered.some((cs) => cs.id === id),
      );
      if (
        unknown.length ||
        (!dto.classIds?.length && !dto.classSubjectIds?.length)
      ) {
        throw new BadRequestException({
          message: "Pick classes or class subjects of the exam's session",
          code: 'SUBJECT_NOT_IN_SESSION',
          classSubjectIds: unknown,
        });
      }
      const present = new Set(
        (await this.subjectRepo.findClassSubjectIds(examId)).map(
          (s) => s.classSubjectId,
        ),
      );
      for (const [index, cs] of wanted.entries()) {
        if (present.has(cs.id)) continue;
        await this.attach(examId, cs, index);
      }
      if (exam.status === ExamStatus.OPEN) await this.prepareMarking(exam);
      return this.subjectRepo.findForExam(examId);
    });
  }

  /** Changes this exam's marks scheme for a subject (no marks yet). */
  updateSubject(
    examId: string,
    examSubjectId: string,
    dto: UpdateExamSubjectDto,
  ): Promise<ExamSubject> {
    return this.ds.runInTransaction(async () => {
      const subject = await this.findSubject(examId, examSubjectId);
      await this.assertNoMarks([subject.id], 'MARKS_EXIST');
      let fullMarks: number | undefined;
      if (dto.components) {
        const codes = new Set(dto.components.map((c) => c.component));
        if (codes.size !== dto.components.length) {
          throw new BadRequestException({
            message: 'Each component can appear once',
            code: 'DUPLICATE_COMPONENT',
          });
        }
        for (const c of dto.components) assertPass(c.passMarks, c.fullMarks);
        fullMarks = dto.components.reduce((n, c) => n + c.fullMarks, 0);
        await this.subjectRepo.replaceComponents(
          subject.id,
          dto.components.map((c, i) => ({
            component: c.component,
            fullMarks: c.fullMarks,
            passMarks: c.passMarks ?? null,
            sortOrder: i,
          })),
        );
      }
      const passMarks =
        dto.passMarks !== undefined ? dto.passMarks : subject.passMarks;
      assertPass(passMarks, fullMarks ?? subject.fullMarks);
      await this.subjectRepo.updateMarks(subject.id, {
        fullMarks,
        passMarks: dto.passMarks,
        sortOrder: dto.sortOrder,
      });
      return (await this.subjectRepo.findWithComponents(subject.id))!;
    });
  }

  /** Only while it has no marks; its mark sheets go with it. */
  async removeSubject(examId: string, examSubjectId: string): Promise<void> {
    const subject = await this.findSubject(examId, examSubjectId);
    await this.assertNoMarks([subject.id], 'MARKS_EXIST');
    await this.subjectRepo.deleteById(subject.id);
  }

  /** Opens mark entry: mark sheets and the per-class result definitions. */
  open(examId: string): Promise<Exam> {
    return this.ds.runInTransaction(async () => {
      const exam = await this.findById(examId);
      if (!(await this.subjectRepo.findClassSubjectIds(examId)).length) {
        throw new ConflictException({
          message: 'Attach subjects before opening the exam',
          code: 'EXAM_HAS_NO_SUBJECTS',
        });
      }
      await this.examRepo.updateFields(examId, { status: ExamStatus.OPEN });
      await this.prepareMarking(exam);
      return this.findById(examId);
    });
  }

  /**
   * Creates any missing mark sheets (one per subject and active section of
   * its class) and the exam's result definition per class. Idempotent, so
   * sections added later get theirs by calling it again.
   */
  async prepareMarking(exam: Exam): Promise<void> {
    const subjects = await this.subjectRepo.findClassSubjectIds(exam.id);
    const sections = (
      await this.sections.findInYear(exam.academicYearId)
    ).filter((s) => s.isActive);
    await this.sheetRepo.ensure(
      subjects.flatMap((es) =>
        sections
          .filter((s) => s.classId === es.classId)
          .map((s) => ({ examSubjectId: es.id, sectionId: s.id })),
      ),
    );
    for (const classId of new Set(subjects.map((s) => s.classId))) {
      await this.definitions.ensureForExam(exam, classId);
    }
  }

  async findSubject(
    examId: string,
    examSubjectId: string,
  ): Promise<ExamSubject> {
    const subject = await this.subjectRepo.findWithComponents(examSubjectId);
    if (!subject || subject.examId !== examId) {
      throw new NotFoundException('Exam subject not found');
    }
    return subject;
  }

  private async attach(examId: string, cs: ClassSubject, index: number) {
    const components: {
      component: string;
      fullMarks: number;
      passMarks: number | null;
    }[] = cs.components?.length
      ? [...cs.components].sort((a, b) => a.sortOrder - b.sortOrder)
      : [
          {
            component: SubjectComponent.WRITTEN,
            fullMarks: cs.fullMarks ?? 100,
            passMarks: null,
          },
        ];
    const fullMarks = components.reduce((n, c) => n + c.fullMarks, 0);
    const saved = await this.subjectRepo.saveNew({
      examId,
      classSubjectId: cs.id,
      classId: cs.classId,
      fullMarks,
      passMarks:
        cs.passMarks !== null && cs.passMarks <= fullMarks
          ? cs.passMarks
          : null,
      sortOrder: index,
    });
    await this.subjectRepo.replaceComponents(
      saved.id,
      components.map((c, i) => ({
        component: c.component,
        fullMarks: c.fullMarks,
        passMarks: c.passMarks,
        sortOrder: i,
      })),
    );
  }

  private async assertRefs(
    academicYearId: string,
    dto: { termId?: string | null; examTypeId?: string | null },
  ) {
    if (dto.termId) {
      const term = await this.terms.findById(dto.termId);
      if (term.academicYearId !== academicYearId) {
        throw new BadRequestException({
          message: "The term is not in the exam's session",
          code: 'TERM_NOT_IN_SESSION',
        });
      }
    }
    if (dto.examTypeId) await this.types.findById(dto.examTypeId);
  }

  private async assertNameFree(academicYearId: string, name: string) {
    if (await this.examRepo.findByName(academicYearId, name)) {
      throw new ConflictException({
        message: `The session already has an exam called "${name}"`,
        code: 'EXAM_EXISTS',
      });
    }
  }

  private async assertNoMarks(examSubjectIds: string[], code: string) {
    if (await this.markRepo.countForExamSubjects(examSubjectIds)) {
      throw new ConflictException({
        message: 'Marks have been entered; this can no longer change',
        code,
      });
    }
  }
}

function assertDates(
  year: { startDate: string | null; endDate: string | null },
  start: string | null,
  end: string | null,
) {
  const outside = (d: string | null) =>
    !!d &&
    ((!!year.startDate && d < year.startDate) ||
      (!!year.endDate && d > year.endDate));
  if (outside(start) || outside(end)) {
    throw new BadRequestException({
      message: "The exam's dates must fall inside the session",
      code: 'DATE_OUTSIDE_SESSION',
    });
  }
  if (start && end && end < start) {
    throw new BadRequestException({
      message: 'The exam must end on or after it starts',
      code: 'INVALID_DATE_RANGE',
    });
  }
}

function assertPass(pass: number | null | undefined, full: number) {
  if (pass !== null && pass !== undefined && pass > full) {
    throw new BadRequestException({
      message: 'Pass marks can’t exceed full marks',
      code: 'INVALID_PASS_MARKS',
    });
  }
}
