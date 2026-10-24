import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { FileService } from '~/modules/files/file.service';
import type { Result } from '../entities/result.entity';
import { ResultRepository } from '../repositories/result.repository';
import { ResultDefinitionService } from './result-definition.service';

/** One student's row on the tabulation sheet. */
export interface ResultRow {
  id: string;
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  name: string;
  nameBn: string | null;
  rollNo: string | null;
  sectionId: string;
  sectionName: string;
  total: number;
  fullMarks: number;
  percentage: number;
  gpa: number | null;
  grade: string;
  passed: boolean;
  failedCount: number;
  graceUsed: number;
  positionSection: number | null;
  positionClass: number | null;
  remarks: string | null;
  publishedAt: Date | null;
  subjects: {
    classSubjectId: string;
    subjectName: string;
    subjectCode: string | null;
    marks: number;
    fullMarks: number;
    grade: string | null;
    point: number | null;
    passed: boolean;
    absent: boolean;
    exempt: boolean;
    isFourth: boolean;
    grace: number;
    /** Component marks, e.g. `CQ 55 · MCQ 22` (one-component subjects: ''). */
    parts: string;
  }[];
}

export interface SubjectAnalysis {
  classSubjectId: string;
  subjectName: string;
  sat: number;
  absent: number;
  passed: number;
  failed: number;
  passRate: number | null;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  grades: Record<string, number>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tabulated results (PRD 6.9): the tabulation sheet, merit list, failed
 * list and subject-wise analysis of a definition, results per student,
 * and the class teacher's remarks. `allowed` is the caller's sections
 * (null = every one).
 */
@Injectable()
export class ResultService {
  constructor(
    private readonly resultRepo: ResultRepository,
    private readonly definitions: ResultDefinitionService,
    private readonly files: FileService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
  ) {}

  /** The tabulation sheet, in class merit order. */
  async rows(
    definitionId: string,
    sectionId: string | undefined,
    allowed: string[] | null,
  ): Promise<ResultRow[]> {
    await this.definitions.findById(definitionId);
    let sections = sectionId ? [sectionId] : null;
    if (allowed !== null) {
      sections = sections
        ? sections.filter((s) => allowed.includes(s))
        : allowed;
    }
    if (sections && !sections.length) return [];
    const results = await this.resultRepo.findForDefinition(
      definitionId,
      sections,
    );
    return results
      .map(toRow)
      .sort(
        (a, b) =>
          (a.positionClass ?? 1e9) - (b.positionClass ?? 1e9) ||
          a.name.localeCompare(b.name),
      );
  }

  /** Merit order (section positions when one section is asked for). */
  async merit(
    definitionId: string,
    sectionId: string | undefined,
    allowed: string[] | null,
    limit?: number,
  ): Promise<ResultRow[]> {
    const rows = await this.rows(definitionId, sectionId, allowed);
    const key = sectionId ? 'positionSection' : 'positionClass';
    rows.sort((a, b) => (a[key] ?? 1e9) - (b[key] ?? 1e9));
    return limit ? rows.filter((r) => (r[key] ?? 1e9) <= limit) : rows;
  }

  /** Failed students with the subjects they failed. */
  async failed(
    definitionId: string,
    sectionId: string | undefined,
    allowed: string[] | null,
  ) {
    return (await this.rows(definitionId, sectionId, allowed))
      .filter((r) => !r.passed)
      .map((r) => ({
        ...r,
        failedSubjects: r.subjects
          .filter((s) => !s.passed && !s.isFourth && !s.exempt)
          .map((s) => s.subjectName),
      }));
  }

  /** Per subject: sat, absent, pass rate, average, highest, grades. */
  async analysis(
    definitionId: string,
    sectionId: string | undefined,
    allowed: string[] | null,
  ): Promise<SubjectAnalysis[]> {
    const rows = await this.rows(definitionId, sectionId, allowed);
    const bySubject = new Map<string, SubjectAnalysis & { sum: number }>();
    for (const row of rows) {
      for (const s of row.subjects) {
        if (s.exempt) continue;
        const a = bySubject.get(s.classSubjectId) ?? {
          classSubjectId: s.classSubjectId,
          subjectName: s.subjectName,
          sat: 0,
          absent: 0,
          passed: 0,
          failed: 0,
          passRate: null,
          average: null,
          highest: null,
          lowest: null,
          grades: {},
          sum: 0,
        };
        if (s.absent) {
          a.absent++;
        } else {
          a.sat++;
          a.sum += s.marks;
          a.highest = Math.max(a.highest ?? -Infinity, s.marks);
          a.lowest = Math.min(a.lowest ?? Infinity, s.marks);
        }
        if (s.passed) a.passed++;
        else a.failed++;
        if (s.grade) a.grades[s.grade] = (a.grades[s.grade] ?? 0) + 1;
        bySubject.set(s.classSubjectId, a);
      }
    }
    return [...bySubject.values()].map(({ sum, ...a }) => ({
      ...a,
      average: a.sat ? round2(sum / a.sat) : null,
      passRate:
        a.passed + a.failed
          ? round2((a.passed / (a.passed + a.failed)) * 100)
          : null,
    }));
  }

  /** One result; 404 outside `allowed`. */
  async findById(id: string, allowed: string[] | null): Promise<Result> {
    const result = await this.resultRepo.findWithRelations(id);
    if (!result || (allowed !== null && !allowed.includes(result.sectionId))) {
      throw new NotFoundException(`Result "${id}" not found`);
    }
    return result;
  }

  async row(id: string, allowed: string[] | null): Promise<ResultRow> {
    return toRow(await this.findById(id, allowed));
  }

  async setRemarks(id: string, remarks: string, allowed: string[] | null) {
    const result = await this.findById(id, allowed);
    await this.resultRepo.updateFields(id, {
      remarks: remarks.trim() || null,
      remarksBy: this.context.current().userId,
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.RESULT_REMARKS_UPDATED,
      entityType: 'result',
      entityId: id,
      before: { remarks: result.remarks },
      after: { remarks: remarks.trim() || null },
    });
    return this.row(id, null);
  }

  async reportCardUrl(id: string, allowed: string[] | null) {
    const result = await this.findById(id, allowed);
    if (!result.reportCardFileId) {
      throw new NotFoundException({
        message: 'No report card yet: generate the section’s cards first',
        code: 'NO_REPORT_CARD',
      });
    }
    return { url: await this.files.getDownloadUrl(result.reportCardFileId) };
  }

  /** Published results of some enrollments, newest first (student 360). */
  async publishedFor(enrollmentIds: string[]) {
    return (
      await this.resultRepo.findPublishedForEnrollments(enrollmentIds)
    ).map((r) => ({
      id: r.id,
      resultDefinitionId: r.resultDefinitionId,
      name: r.definition?.name ?? '',
      gpa: r.gpa,
      grade: r.grade,
      passed: r.passed,
      positionClass: r.positionClass,
      positionSection: r.positionSection,
      publishedAt: r.publishedAt,
    }));
  }

  /**
   * The class's latest published session result, for promotion: a
   * combined definition when one is published, else the latest published
   * exam. Null when nothing is published.
   */
  async publishedOutcomes(
    academicYearId: string,
    classId: string,
  ): Promise<{
    resultDefinitionId: string;
    byEnrollment: Map<
      string,
      { passed: boolean; positionClass: number | null }
    >;
  } | null> {
    const published = (
      await this.definitions.findFiltered({ academicYearId, classId })
    ).filter((d) => d.publishedAt && d.status.current);
    const pick = (list: typeof published) =>
      [...list].sort(
        (a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime(),
      )[0];
    const chosen = pick(published.filter((d) => !d.examId)) ?? pick(published);
    if (!chosen) return null;
    const results = await this.resultRepo.findLight(chosen.id);
    return {
      resultDefinitionId: chosen.id,
      byEnrollment: new Map(
        results.map((r) => [
          r.enrollmentId,
          { passed: r.passed, positionClass: r.positionClass },
        ]),
      ),
    };
  }

  /** Records attached to a report card (the PDF job). */
  async setReportCard(id: string, fileId: string): Promise<void> {
    await this.resultRepo.updateFields(id, { reportCardFileId: fileId });
  }
}

export function toRow(r: Result): ResultRow {
  const e = r.enrollment;
  return {
    id: r.id,
    enrollmentId: r.enrollmentId,
    studentId: e?.studentId ?? '',
    admissionNumber: e?.student?.admissionNumber ?? '',
    name: e?.student?.fullName ?? '',
    nameBn: e?.student?.nameBn ?? null,
    rollNo: e?.rollNo ?? null,
    sectionId: r.sectionId,
    sectionName: e?.section?.name ?? '',
    total: r.total,
    fullMarks: r.fullMarks,
    percentage: r.percentage,
    gpa: r.gpa,
    grade: r.grade,
    passed: r.passed,
    failedCount: r.failedCount,
    graceUsed: r.graceUsed,
    positionSection: r.positionSection,
    positionClass: r.positionClass,
    remarks: r.remarks,
    publishedAt: r.publishedAt,
    subjects: (r.subjects ?? [])
      .map((s) => ({
        classSubjectId: s.classSubjectId,
        subjectName: s.classSubject?.subject?.name ?? '',
        subjectCode: s.classSubject?.subject?.code ?? null,
        marks: s.marks,
        fullMarks: s.fullMarks,
        grade: s.grade,
        point: s.point,
        passed: s.passed,
        absent: s.absent,
        exempt: s.exempt,
        isFourth: s.isFourth,
        grace: s.grace,
        parts:
          s.components.length > 1
            ? s.components
                .filter((c) => !c.exempt)
                .map(
                  (c) =>
                    `${c.code.toUpperCase()} ${c.absent ? 'Ab' : (c.value ?? 0)}`,
                )
                .join(' · ')
            : '',
      }))
      .sort(
        (a, b) =>
          Number(a.isFourth) - Number(b.isFourth) ||
          a.subjectName.localeCompare(b.subjectName),
      ),
  };
}
