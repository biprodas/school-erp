import { Inject, Injectable } from '@nestjs/common';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { ClassSubjectType } from '~/modules/class-curriculum/enums/class-subject-type.enum';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import {
  combineExams,
  gradeResult,
  rank,
  type OverallResult,
  type RankRow,
  type SubjectInput,
} from '~/modules/grading/engine';
import { GradingService } from '~/modules/grading/services/grading.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import type { ExamSubject } from '../entities/exam-subject.entity';
import { FINAL_SHEET_STATUSES } from '../enums/exam.enum';
import { ExamSubjectRepository } from '../repositories/exam-subject.repository';
import { MarkRepository } from '../repositories/mark.repository';
import { MarkSheetRepository } from '../repositories/mark-sheet.repository';
import { ResultDefinitionRepository } from '../repositories/result-definition.repository';
import { ResultRepository } from '../repositories/result.repository';
import { type GridCell, subjectInput } from './mark-sheet.service';
import { takesSubject } from './subject-takers';

export interface TabulationSummary {
  students: number;
  passed: number;
  failed: number;
  /** Skipped: some sheets were no longer approved when the job ran. */
  skipped?: boolean;
}

/**
 * Tabulation (PRD 6.9, workflow 7.4 step 4): every student of the class
 * who sits the definition's exams, graded by the class's grading system
 * (combined by weight across exams), with section and class positions.
 * One transaction; remarks and report cards survive a re-tabulation, and
 * results go back to unpublished until the definition is published again.
 */
@Injectable()
export class TabulationService {
  constructor(
    private readonly definitionRepo: ResultDefinitionRepository,
    private readonly subjectRepo: ExamSubjectRepository,
    private readonly sheetRepo: MarkSheetRepository,
    private readonly markRepo: MarkRepository,
    private readonly resultRepo: ResultRepository,
    private readonly enrollments: EnrollmentService,
    private readonly grading: GradingService,
    private readonly settings: SettingsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  tabulate(definitionId: string): Promise<TabulationSummary> {
    return this.ds.runInTransaction(async () => {
      const started = new Date();
      const definition = await this.definitionRepo.findByIdOrFail(definitionId);
      const examIds = definition.items.map((i) => i.examId);
      const subjects = await this.subjectRepo.findForExams(
        examIds,
        definition.classId,
      );
      const sheets = await this.sheetRepo.findForExamSubjects(
        subjects.map((s) => s.id),
      );
      if (
        !sheets.length ||
        sheets.some((s) => !FINAL_SHEET_STATUSES.includes(s.status))
      ) {
        return { students: 0, passed: 0, failed: 0, skipped: true };
      }

      // examSubjectId → enrollmentId → componentId → cell
      const sheetSubject = new Map(sheets.map((s) => [s.id, s.examSubjectId]));
      const cells = new Map<string, Map<string, Record<string, GridCell>>>();
      for (const m of await this.markRepo.findBySheets(
        sheets.map((s) => s.id),
      )) {
        const esId = sheetSubject.get(m.markSheetId)!;
        if (!cells.has(esId)) cells.set(esId, new Map());
        const own = cells.get(esId)!;
        own.set(m.enrollmentId, {
          ...(own.get(m.enrollmentId) ?? {}),
          [m.componentId]: {
            value: m.value,
            absent: m.absent,
            exempt: m.exempt,
          },
        });
      }

      const { scheme } = await this.grading.schemeFor(
        definition.academicYearId,
        definition.classId,
      );
      const { tieBreakers } = await this.settings.getSection('results');
      const takers = await this.enrollments.findExamTakers(
        definition.academicYearId,
        definition.classId,
      );
      const choices = await this.enrollments.subjectChoices(
        takers.map((e) => e.id),
      );
      const byExam = new Map<string, ExamSubject[]>();
      for (const s of subjects)
        byExam.set(s.examId, [...(byExam.get(s.examId) ?? []), s]);

      const graded: {
        enrollmentId: string;
        sectionId: string;
        roll: string | null;
        result: OverallResult;
      }[] = [];
      for (const e of takers) {
        const exams = definition.items.map((item) => ({
          weight: item.weight,
          subjects: (byExam.get(item.examId) ?? []).flatMap(
            (es): SubjectInput[] => {
              const cs = es.classSubject!;
              const t = takesSubject(e, cs, choices.get(e.id));
              if (!t.takes) return [];
              const own = cells.get(es.id)?.get(e.id);
              // No marks at all for a subject they sit: absent.
              const entered: Record<string, GridCell> =
                own ??
                Object.fromEntries(
                  es.components!.map((c) => [
                    c.id,
                    { value: null, absent: true, exempt: false },
                  ]),
                );
              return [
                subjectInput(
                  es,
                  entered,
                  t.isFourth,
                  cs.subjectType === ClassSubjectType.COMPULSORY && !t.isFourth,
                ),
              ];
            },
          ),
        }));
        const inputs = combineExams(exams.filter((x) => x.subjects.length));
        if (!inputs.length) continue;
        graded.push({
          enrollmentId: e.id,
          sectionId: e.sectionId,
          roll: e.rollNo,
          result: gradeResult(inputs, scheme),
        });
      }

      const row = (g: (typeof graded)[number]): RankRow => ({
        id: g.enrollmentId,
        passed: g.result.passed,
        failedCount: g.result.failedCount,
        gpa: g.result.gpa,
        total: g.result.total,
        percentage: g.result.percentage,
        compulsoryTotal: g.result.compulsoryTotal,
        roll: g.roll,
      });
      const classPositions = rank(graded.map(row), tieBreakers);
      const sectionPositions = new Map<string, number>();
      for (const sectionId of new Set(graded.map((g) => g.sectionId))) {
        for (const [id, p] of rank(
          graded.filter((g) => g.sectionId === sectionId).map(row),
          tieBreakers,
        )) {
          sectionPositions.set(id, p);
        }
      }

      const existing = new Map(
        (await this.resultRepo.findLight(definitionId)).map((r) => [
          r.enrollmentId,
          r,
        ]),
      );
      for (const g of graded) {
        const r = g.result;
        const fields = {
          sectionId: g.sectionId,
          total: r.total,
          fullMarks: r.fullMarks,
          percentage: r.percentage,
          gpa: r.gpa,
          gpaWithoutFourth: r.gpaWithoutFourth,
          grade: r.grade,
          passed: r.passed,
          failedCount: r.failedCount,
          graceUsed: r.graceUsed,
          positionSection: sectionPositions.get(g.enrollmentId) ?? null,
          positionClass: classPositions.get(g.enrollmentId) ?? null,
          computedAt: started,
          publishedAt: null,
        };
        const old = existing.get(g.enrollmentId);
        const resultId = old
          ? (await this.resultRepo.updateFields(old.id, fields), old.id)
          : await this.resultRepo.insertOne({
              resultDefinitionId: definitionId,
              enrollmentId: g.enrollmentId,
              remarks: null,
              remarksBy: null,
              reportCardFileId: null,
              ...fields,
            });
        await this.resultRepo.replaceSubjects(
          resultId,
          r.subjects.map((s) => ({
            classSubjectId: s.id,
            marks: s.marks,
            fullMarks: s.fullMarks,
            percentage: s.percentage,
            grade: s.letter,
            point: s.point,
            passed: s.passed,
            absent: s.absent,
            exempt: s.exempt,
            isFourth: s.isFourth,
            grace: s.grace,
            components: s.components,
          })),
        );
        existing.delete(g.enrollmentId);
      }
      // Students no longer in the class lose their stale rows.
      await this.resultRepo.deleteMany([...existing.values()].map((r) => r.id));
      await this.definitionRepo.updateFields(definitionId, {
        computedAt: started,
        publishedAt: null,
        publishedBy: null,
      });
      const passed = graded.filter((g) => g.result.passed).length;
      return {
        students: graded.length,
        passed,
        failed: graded.length - passed,
      };
    });
  }
}
