import { Injectable, NotFoundException } from '@nestjs/common';
import { QUEUES } from '~/shared/queue';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { ResultExportDto, ReportCardsDto } from '../dto/result.dto';
import { ResultSheetType } from '../enums/exam.enum';
import { ResultDefinitionService } from './result-definition.service';
import { type ResultRow, ResultService } from './result.service';

export const REPORT_CARDS_JOB = 'report-cards';
export const RESULT_EXPORT_JOB = 'result-export';

export interface ReportCardsJobData {
  resultDefinitionId: string;
  sectionId: string;
  language: 'en' | 'bn';
}

export interface ResultExportJobData extends ResultExportDto {
  resultDefinitionId: string;
  /** The requester's scope when asked (null = every section). */
  allowed: string[] | null;
}

export interface SheetTable {
  title: string;
  headers: string[];
  keys: string[];
  rows: Record<string, string | number | null>[];
}

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n;

/**
 * Report cards (PRD 6.9: bulk PDF per section, one file per student plus
 * the whole section) and result sheets as Excel or PDF: merit list,
 * tabulation sheet, failed list and subject-wise analysis. Both run as
 * jobs; this service checks the request and queues them.
 */
@Injectable()
export class ResultDocumentService {
  constructor(
    private readonly definitions: ResultDefinitionService,
    private readonly results: ResultService,
    private readonly sections: SectionService,
    private readonly settings: SettingsService,
    private readonly jobs: JobService,
  ) {}

  async startReportCards(
    definitionId: string,
    dto: ReportCardsDto,
  ): Promise<Job> {
    const definition = await this.definitions.findById(definitionId);
    const section = await this.sections.findById(dto.sectionId);
    if (
      section.classId !== definition.classId ||
      section.academicYearId !== definition.academicYearId
    ) {
      throw new NotFoundException('Section not found');
    }
    const language =
      dto.language ??
      (await this.settings.getSection('results')).reportCard.language;
    return this.jobs.start<ReportCardsJobData>({
      type: 'results.report_cards',
      queue: QUEUES.pdf,
      name: REPORT_CARDS_JOB,
      data: {
        resultDefinitionId: definitionId,
        sectionId: dto.sectionId,
        language,
      },
    });
  }

  async startExport(
    definitionId: string,
    dto: ResultExportDto,
    allowed: string[] | null,
  ): Promise<Job> {
    await this.definitions.findById(definitionId);
    return this.jobs.start<ResultExportJobData>({
      type: 'results.export',
      queue: dto.format === 'pdf' ? QUEUES.pdf : QUEUES.exports,
      name: RESULT_EXPORT_JOB,
      data: { ...dto, resultDefinitionId: definitionId, allowed },
    });
  }

  /** A result sheet as rows (shared by the Excel and PDF exports). */
  async table(data: ResultExportJobData): Promise<SheetTable> {
    const { resultDefinitionId: id, sectionId, allowed } = data;
    const definition = await this.definitions.findById(id);
    const name = `${definition.name} · ${definition.schoolClass?.name ?? ''}`;
    switch (data.type) {
      case ResultSheetType.MERIT: {
        const rows = await this.results.merit(id, sectionId, allowed);
        return {
          title: `Merit list · ${name}`,
          headers: [
            'Position',
            'Roll',
            'Name',
            'ID',
            'Section',
            'Total',
            'GPA',
            'Grade',
          ],
          keys: [
            'position',
            'roll',
            'name',
            'id',
            'section',
            'total',
            'gpa',
            'grade',
          ],
          rows: rows.map((r) => ({
            position: fmt(sectionId ? r.positionSection : r.positionClass),
            roll: r.rollNo,
            name: r.name,
            id: r.admissionNumber,
            section: r.sectionName,
            total: r.total,
            gpa: fmt(r.gpa),
            grade: r.grade,
          })),
        };
      }
      case ResultSheetType.FAILED: {
        const rows = await this.results.failed(id, sectionId, allowed);
        return {
          title: `Failed list · ${name}`,
          headers: [
            'Roll',
            'Name',
            'ID',
            'Section',
            'Failed subjects',
            'Total',
          ],
          keys: ['roll', 'name', 'id', 'section', 'subjects', 'total'],
          rows: rows.map((r) => ({
            roll: r.rollNo,
            name: r.name,
            id: r.admissionNumber,
            section: r.sectionName,
            subjects: r.failedSubjects.join(', '),
            total: r.total,
          })),
        };
      }
      case ResultSheetType.ANALYSIS: {
        const rows = await this.results.analysis(id, sectionId, allowed);
        return {
          title: `Subject-wise analysis · ${name}`,
          headers: [
            'Subject',
            'Sat',
            'Absent',
            'Passed',
            'Failed',
            'Pass %',
            'Average',
            'Highest',
            'Lowest',
          ],
          keys: [
            'subject',
            'sat',
            'absent',
            'passed',
            'failed',
            'passRate',
            'average',
            'highest',
            'lowest',
          ],
          rows: rows.map((a) => ({
            subject: a.subjectName,
            sat: a.sat,
            absent: a.absent,
            passed: a.passed,
            failed: a.failed,
            passRate: fmt(a.passRate),
            average: fmt(a.average),
            highest: fmt(a.highest),
            lowest: fmt(a.lowest),
          })),
        };
      }
      default: {
        const rows = await this.results.rows(id, sectionId, allowed);
        const subjects = subjectColumns(rows);
        return {
          title: `Tabulation sheet · ${name}`,
          headers: [
            'Position',
            'Roll',
            'Name',
            'Section',
            ...subjects.map((s) => s.name),
            'Total',
            'GPA',
            'Grade',
            'Result',
          ],
          keys: [
            'position',
            'roll',
            'name',
            'section',
            ...subjects.map((s) => s.id),
            'total',
            'gpa',
            'grade',
            'result',
          ],
          rows: rows.map((r) => ({
            position: fmt(r.positionClass),
            roll: r.rollNo,
            name: r.name,
            section: r.sectionName,
            ...Object.fromEntries(
              subjects.map((s) => {
                const x = r.subjects.find((y) => y.classSubjectId === s.id);
                const value = !x
                  ? ''
                  : x.exempt
                    ? 'Ex'
                    : x.absent
                      ? 'Ab'
                      : `${x.marks} (${x.grade ?? ''})`;
                return [s.id, value];
              }),
            ),
            total: r.total,
            gpa: fmt(r.gpa),
            grade: r.grade,
            result: r.passed ? 'Pass' : 'Fail',
          })),
        };
      }
    }
  }
}

function subjectColumns(rows: ResultRow[]) {
  const seen = new Map<string, string>();
  for (const r of rows) {
    for (const s of r.subjects)
      seen.set(s.classSubjectId, s.subjectCode ?? s.subjectName);
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}
