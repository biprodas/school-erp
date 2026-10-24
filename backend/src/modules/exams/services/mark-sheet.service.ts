import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import type { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import {
  gradeSubject,
  type SubjectInput,
  type SubjectResult,
} from '~/modules/grading/engine';
import { GradingService } from '~/modules/grading/services/grading.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { MarkEntryDto, SaveMarksDto } from '../dto/mark-sheet.dto';
import type { ExamSubject } from '../entities/exam-subject.entity';
import type { Mark } from '../entities/mark.entity';
import type { MarkSheet } from '../entities/mark-sheet.entity';
import { ExamStatus, MarkSheetStatus } from '../enums/exam.enum';
import { MarkRepository } from '../repositories/mark.repository';
import { MarkSheetRepository } from '../repositories/mark-sheet.repository';
import { ResultDefinitionService } from './result-definition.service';
import { takesSubject } from './subject-takers';

export interface GridCell {
  value: number | null;
  absent: boolean;
  exempt: boolean;
}

export interface GridRow {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  name: string;
  rollNo: string | null;
  isFourth: boolean;
  /** Still enrolled in the section. */
  active: boolean;
  /** Component id → cell (missing = not entered). */
  marks: Record<string, GridCell>;
  /** Every component entered (a value, absent or exempt). */
  complete: boolean;
  /** The engine's grade for what is entered so far. */
  computed: SubjectResult;
}

/** A sheet's student list: who sits the subject in the section. */
export interface Roster {
  enrollments: StudentEnrollment[];
  fourth: Set<string>;
}

const byRoll = (a: string | null, b: string | null) => {
  const na = Number(a);
  const nb = Number(b);
  if (a && b && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return (a ?? '￿').localeCompare(b ?? '￿');
};

/**
 * Mark sheets (PRD 6.9 mark entry, workflow 7.4): the grid of a subject in
 * a section with grades computed as marks come in, and its workflow
 * Draft → Submitted → (Verified, with `results.verifyStep`) → Approved →
 * Published. Only drafts take marks; approved sheets are read-only until
 * reopened, and mark changes after the first submit are audited with old
 * and new values. Scope is checked by the controller.
 */
@Injectable()
export class MarkSheetService {
  constructor(
    private readonly sheetRepo: MarkSheetRepository,
    private readonly markRepo: MarkRepository,
    private readonly enrollments: EnrollmentService,
    private readonly grading: GradingService,
    private readonly settings: SettingsService,
    private readonly definitions: ResultDefinitionService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** An exam's sheets, filtered to `allowed` sections (null = all). */
  async listForExam(
    examId: string,
    filter: { classId?: string; sectionId?: string },
    allowed: string[] | null,
  ) {
    // Nested where values aren't dropped when undefined: build it up.
    const where: FindOptionsWhere<MarkSheet> = {
      examSubject: filter.classId
        ? { examId, classId: filter.classId }
        : { examId },
    };
    if (filter.sectionId) where.sectionId = filter.sectionId;
    const sheets = await this.sheetRepo.findMany(where);
    return sheets
      .filter((s) => allowed === null || allowed.includes(s.sectionId))
      .map((s) => ({
        id: s.id,
        examSubjectId: s.examSubjectId,
        classSubjectId: s.examSubject!.classSubjectId,
        classId: s.examSubject!.classId,
        subjectName: s.examSubject!.classSubject?.subject?.name ?? '',
        sectionId: s.sectionId,
        sectionName: s.section?.name ?? '',
        status: s.status,
        submittedAt: s.submittedAt,
        approvedAt: s.approvedAt,
      }));
  }

  async findById(id: string): Promise<MarkSheet> {
    const sheet = await this.sheetRepo.findWithRelations(id);
    if (!sheet) throw new NotFoundException(`Mark sheet "${id}" not found`);
    return sheet;
  }

  /** `GET /mark-sheets/:id/marks`: the grid with computed grades. */
  async grid(id: string) {
    const sheet = await this.findById(id);
    return this.buildGrid(sheet);
  }

  /** Saves cells of a draft sheet in one transaction; returns the grid. */
  saveMarks(id: string, dto: SaveMarksDto) {
    return this.ds.runInTransaction(async () => {
      const sheet = await this.saveEntries(id, dto.entries);
      return this.buildGrid(sheet);
    });
  }

  /**
   * The checks and writes of `saveMarks`, without the grid (the Excel
   * import calls it per row). Returns the sheet.
   */
  saveEntries(id: string, entries: MarkEntryDto[]): Promise<MarkSheet> {
    return this.ds.runInTransaction(async () => {
      const sheet = await this.lockSheet(id);
      if (sheet.examSubject!.exam!.status !== ExamStatus.OPEN) {
        throw new ConflictException({
          message: 'The exam is not open for marks',
          code: 'EXAM_NOT_OPEN',
        });
      }
      assertStatus(sheet, [MarkSheetStatus.DRAFT], 'MARK_SHEET_LOCKED');
      const components = new Map(
        sheet.examSubject!.components!.map((c) => [c.id, c]),
      );
      const roster = await this.roster(sheet);
      const allowed = new Set(roster.enrollments.map((e) => e.id));
      const existing = new Map(
        (await this.markRepo.findBySheet(id)).map((m) => [cellKey(m), m]),
      );

      const userId = this.context.current().userId;
      const inserts: Partial<Mark>[] = [];
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const seen = new Set<string>();
      for (const entry of entries) {
        const component = components.get(entry.componentId);
        if (!component) {
          throw badEntry(
            entry,
            'UNKNOWN_COMPONENT',
            'Not a component of this subject',
          );
        }
        if (!allowed.has(entry.enrollmentId)) {
          throw badEntry(
            entry,
            'NOT_IN_ROSTER',
            'The student does not sit this subject here',
          );
        }
        const key = cellKey(entry);
        if (seen.has(key)) {
          throw badEntry(entry, 'DUPLICATE_ENTRY', 'A cell appears twice');
        }
        seen.add(key);
        const cell = normalize(entry);
        if (cell.value !== null && cell.value > component.fullMarks) {
          throw badEntry(
            entry,
            'MARK_OUT_OF_RANGE',
            `At most ${component.fullMarks} marks`,
          );
        }
        const old = existing.get(key);
        if (old) {
          if (
            old.value === cell.value &&
            old.absent === cell.absent &&
            old.exempt === cell.exempt
          ) {
            continue;
          }
          before[key] = describe(old);
          await this.markRepo.updateFields(old.id, {
            ...cell,
            updatedBy: userId,
          });
        } else {
          before[key] = null;
          inserts.push({
            markSheetId: id,
            enrollmentId: entry.enrollmentId,
            componentId: entry.componentId,
            ...cell,
            updatedBy: userId,
          });
        }
        after[key] = describe(cell);
      }
      await this.markRepo.insertMany(inserts);
      // Changes after the first submit are corrections: keep both values.
      if (sheet.firstSubmittedAt && Object.keys(after).length) {
        await this.audit.record({
          action: AUDIT_ACTIONS.MARKS_CHANGED,
          entityType: 'mark_sheet',
          entityId: id,
          before,
          after,
        });
      }
      return sheet;
    });
  }

  /** Draft → Submitted, once every student has every component. */
  submit(id: string) {
    return this.transition(id, async (sheet) => {
      assertStatus(sheet, [MarkSheetStatus.DRAFT], 'MARK_SHEET_WRONG_STATUS');
      const grid = await this.buildGrid(sheet);
      const missing = grid.students.filter((r) => !r.complete);
      if (missing.length) {
        throw new ConflictException({
          message: 'Enter every mark (or absent/exempt) before submitting',
          code: 'MARKS_INCOMPLETE',
          enrollmentIds: missing.map((r) => r.enrollmentId),
        });
      }
      const now = new Date();
      return {
        status: MarkSheetStatus.SUBMITTED,
        submittedAt: now,
        submittedBy: this.userId,
        firstSubmittedAt: sheet.firstSubmittedAt ?? now,
      };
    });
  }

  /** Submitted → Verified (only with the verify step on). */
  verify(id: string) {
    return this.transition(id, async (sheet) => {
      if (!(await this.settings.getSection('results')).verifyStep) {
        throw new ConflictException({
          message: 'This school has no verify step',
          code: 'VERIFY_STEP_OFF',
        });
      }
      assertStatus(
        sheet,
        [MarkSheetStatus.SUBMITTED],
        'MARK_SHEET_WRONG_STATUS',
      );
      return {
        status: MarkSheetStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedBy: this.userId,
      };
    });
  }

  /**
   * Submitted (or Verified, with the verify step) → Approved. The sheet is
   * read-only from here; results that include it tabulate once all their
   * sheets are approved.
   */
  approve(id: string) {
    return this.approveMany([id]).then(([sheet]) => sheet);
  }

  async approveMany(ids: string[]) {
    const sheets = await this.ds.runInTransaction(async () => {
      const { verifyStep } = await this.settings.getSection('results');
      const ready = verifyStep
        ? [MarkSheetStatus.VERIFIED]
        : [MarkSheetStatus.SUBMITTED, MarkSheetStatus.VERIFIED];
      const sheets: MarkSheet[] = [];
      for (const id of [...new Set(ids)]) {
        const sheet = await this.lockSheet(id);
        assertStatus(
          sheet,
          ready,
          verifyStep ? 'NOT_VERIFIED' : 'MARK_SHEET_WRONG_STATUS',
        );
        await this.sheetRepo.updateFields(id, {
          status: MarkSheetStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: this.userId,
        });
        sheets.push(sheet);
      }
      await this.audit.record({
        action: AUDIT_ACTIONS.MARK_SHEETS_APPROVED,
        entityType: 'mark_sheet',
        entityId: sheets.length === 1 ? sheets[0].id : null,
        after: { markSheetIds: sheets.map((s) => s.id) },
      });
      return sheets;
    });
    // After the commit, so the tabulation job sees the approvals.
    await this.definitions.afterSheetsChanged(
      sheets.map((s) => ({
        examId: s.examSubject!.examId,
        classId: s.examSubject!.classId,
      })),
    );
    return Promise.all(sheets.map((s) => this.findById(s.id)));
  }

  /** Back to draft from any later status, with a reason (audited). */
  reopen(id: string, reason: string) {
    return this.ds.runInTransaction(async () => {
      const sheet = await this.lockSheet(id);
      if (sheet.status === MarkSheetStatus.DRAFT) {
        throw new ConflictException({
          message: 'The sheet is already a draft',
          code: 'MARK_SHEET_WRONG_STATUS',
        });
      }
      await this.sheetRepo.updateFields(id, {
        status: MarkSheetStatus.DRAFT,
        approvedAt: null,
        approvedBy: null,
        verifiedAt: null,
        verifiedBy: null,
        reopenedAt: new Date(),
        reopenedBy: this.userId,
        reopenReason: reason,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.MARK_SHEET_REOPENED,
        entityType: 'mark_sheet',
        entityId: id,
        before: { status: sheet.status },
        after: { status: MarkSheetStatus.DRAFT, reason },
      });
      return this.findById(id);
    });
  }

  // --- Roster and grid ------------------------------------------------------

  /** The students of the section who sit the subject (plus anyone with marks). */
  async roster(sheet: MarkSheet, marks?: Mark[]): Promise<Roster> {
    const cs = sheet.examSubject!.classSubject!;
    const active = await this.enrollments.findActiveInSection(sheet.sectionId);
    const choices = await this.enrollments.subjectChoices(
      active.map((e) => e.id),
    );
    const fourth = new Set<string>();
    const takers = active.filter((e) => {
      const t = takesSubject(e, cs, choices.get(e.id));
      if (t.isFourth) fourth.add(e.id);
      return t.takes;
    });
    const known = new Set(takers.map((e) => e.id));
    const others = [
      ...new Set((marks ?? []).map((m) => m.enrollmentId)),
    ].filter((id) => !known.has(id));
    const extra = others.length ? await this.enrollments.findByIds(others) : [];
    return { enrollments: [...takers, ...extra], fourth };
  }

  async buildGrid(sheet: MarkSheet) {
    const es = sheet.examSubject!;
    const marks = await this.markRepo.findBySheet(sheet.id);
    const roster = await this.roster(sheet, marks);
    const activeIds = new Set(
      (await this.enrollments.findActiveInSection(sheet.sectionId)).map(
        (e) => e.id,
      ),
    );
    const { scheme, system } = await this.grading.schemeFor(
      es.exam!.academicYearId,
      es.classId,
    );
    const byEnrollment = new Map<string, Mark[]>();
    for (const m of marks) {
      byEnrollment.set(m.enrollmentId, [
        ...(byEnrollment.get(m.enrollmentId) ?? []),
        m,
      ]);
    }
    const students: GridRow[] = roster.enrollments.map((e) => {
      const own = byEnrollment.get(e.id) ?? [];
      const cells: Record<string, GridCell> = {};
      for (const m of own) {
        cells[m.componentId] = {
          value: m.value,
          absent: m.absent,
          exempt: m.exempt,
        };
      }
      const isFourth = roster.fourth.has(e.id);
      return {
        enrollmentId: e.id,
        studentId: e.studentId,
        admissionNumber: e.student?.admissionNumber ?? '',
        name: e.student?.fullName ?? '',
        rollNo: e.rollNo,
        isFourth,
        active: activeIds.has(e.id),
        marks: cells,
        complete: es.components!.every((c) => isEntered(cells[c.id])),
        computed: gradeSubject(subjectInput(es, cells, isFourth), scheme),
      };
    });
    students.sort(
      (a, b) => byRoll(a.rollNo, b.rollNo) || a.name.localeCompare(b.name),
    );
    return {
      sheet: {
        id: sheet.id,
        status: sheet.status,
        sectionId: sheet.sectionId,
        sectionName: sheet.section?.name ?? '',
        className: sheet.section?.schoolClass?.name ?? '',
        examId: es.examId,
        examName: es.exam?.name ?? '',
        subjectName: es.classSubject?.subject?.name ?? '',
        firstSubmittedAt: sheet.firstSubmittedAt,
        submittedAt: sheet.submittedAt,
        verifiedAt: sheet.verifiedAt,
        approvedAt: sheet.approvedAt,
        reopenedAt: sheet.reopenedAt,
        reopenReason: sheet.reopenReason,
      },
      subject: {
        id: es.id,
        classSubjectId: es.classSubjectId,
        fullMarks: es.fullMarks,
        passMarks: es.passMarks,
        components: es.components!.map((c) => ({
          id: c.id,
          component: c.component,
          fullMarks: c.fullMarks,
          passMarks: c.passMarks,
        })),
      },
      gradingSystem: { id: system.id, name: system.name },
      students,
    };
  }

  /** Marks of any of the enrollments (promotion rollback checks). */
  countForEnrollments(enrollmentIds: string[]): Promise<number> {
    return this.markRepo.countForEnrollments(enrollmentIds);
  }

  private async transition(
    id: string,
    change: (sheet: MarkSheet) => Promise<Partial<MarkSheet>>,
  ) {
    return this.ds.runInTransaction(async () => {
      const sheet = await this.lockSheet(id);
      const patch = await change(sheet);
      await this.sheetRepo.updateFields(id, patch);
      return this.findById(id);
    });
  }

  private async lockSheet(id: string): Promise<MarkSheet> {
    const sheet = await this.sheetRepo.findWithRelations(id, true);
    if (!sheet) throw new NotFoundException(`Mark sheet "${id}" not found`);
    return sheet;
  }

  private get userId(): string | null {
    return this.context.current().userId;
  }
}

/** The engine input for one student's cells of an exam subject. */
export function subjectInput(
  es: ExamSubject,
  cells: Record<string, GridCell | undefined>,
  isFourth: boolean,
  compulsory = !isFourth,
): SubjectInput {
  return {
    id: es.classSubjectId,
    fullMarks: es.fullMarks,
    passMarks: es.passMarks,
    isFourth,
    compulsory,
    components: es.components!.map((c) => {
      const cell = cells[c.id];
      return {
        code: c.component,
        fullMarks: c.fullMarks,
        passMarks: c.passMarks,
        value: cell?.value ?? null,
        absent: cell?.absent ?? false,
        exempt: cell?.exempt ?? false,
      };
    }),
  };
}

/** A value, absent or exempt (a cleared cell isn't entered). */
const isEntered = (c: GridCell | undefined) =>
  !!c && (c.value !== null || c.absent || c.exempt);

const cellKey = (m: { enrollmentId: string; componentId: string }) =>
  `${m.enrollmentId}:${m.componentId}`;

function normalize(entry: MarkEntryDto): GridCell {
  const absent = entry.absent ?? false;
  const exempt = !absent && (entry.exempt ?? false);
  return {
    value: absent || exempt ? null : (entry.value ?? null),
    absent,
    exempt,
  };
}

const describe = (c: GridCell) =>
  c.absent ? 'absent' : c.exempt ? 'exempt' : c.value;

function badEntry(entry: MarkEntryDto, code: string, message: string) {
  return new BadRequestException({
    message,
    code,
    enrollmentId: entry.enrollmentId,
    componentId: entry.componentId,
  });
}

function assertStatus(
  sheet: MarkSheet,
  allowed: MarkSheetStatus[],
  code: string,
) {
  if (!allowed.includes(sheet.status)) {
    throw new ConflictException({
      message: `The sheet is ${sheet.status}`,
      code,
      status: sheet.status,
    });
  }
}
