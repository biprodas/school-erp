import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { formatNumber, type Numerals } from '~/shared/locale/format';
import { mergePdfs } from '~/shared/pdf/pdf-merge';
import { PdfService } from '~/shared/pdf/pdf.service';
import { writeSheet } from '~/shared/spreadsheet/spreadsheet';
import { AttendanceReportService } from '~/modules/attendance/services/attendance-report.service';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import {
  REPORT_CARDS_JOB,
  RESULT_EXPORT_JOB,
  ResultDocumentService,
  type ReportCardsJobData,
  type ResultExportJobData,
} from './services/result-document.service';
import { TABULATION_JOB } from './services/result-definition.service';
import { ResultDefinitionService } from './services/result-definition.service';
import { type ResultRow, ResultService } from './services/result.service';
import { TabulationService } from './services/tabulation.service';

const LABELS = {
  en: {
    title: 'Progress Report',
    session: 'Session',
    name: 'Name',
    id: 'Student ID',
    class: 'Class',
    section: 'Section',
    roll: 'Roll',
    subject: 'Subject',
    full: 'Full marks',
    obtained: 'Obtained',
    grade: 'Grade',
    point: 'Point',
    fourth: '4th subject',
    total: 'Total',
    gpa: 'GPA',
    result: 'Result',
    passed: 'Passed',
    failed: 'Failed',
    sectionPosition: 'Position in section',
    classPosition: 'Position in class',
    attendance: 'Attendance',
    remarks: 'Remarks',
    absent: 'Absent',
    exempt: 'Exempt',
  },
  bn: {
    title: 'অগ্রগতি প্রতিবেদন',
    session: 'শিক্ষাবর্ষ',
    name: 'নাম',
    id: 'শিক্ষার্থী আইডি',
    class: 'শ্রেণি',
    section: 'শাখা',
    roll: 'রোল',
    subject: 'বিষয়',
    full: 'পূর্ণমান',
    obtained: 'প্রাপ্ত নম্বর',
    grade: 'গ্রেড',
    point: 'পয়েন্ট',
    fourth: '৪র্থ বিষয়',
    total: 'মোট',
    gpa: 'জিপিএ',
    result: 'ফলাফল',
    passed: 'উত্তীর্ণ',
    failed: 'অনুত্তীর্ণ',
    sectionPosition: 'শাখায় অবস্থান',
    classPosition: 'শ্রেণিতে অবস্থান',
    attendance: 'উপস্থিতি',
    remarks: 'মন্তব্য',
    absent: 'অনুপস্থিত',
    exempt: 'অব্যাহতি',
  },
} as const;

const CARD_CSS = `
body{font-size:10pt}
.card{page-break-after:always;padding:4mm}
.card:last-child{page-break-after:auto}
.head{text-align:center;margin-bottom:4mm}
.logo{height:16mm}
.school{font-size:16pt;font-weight:bold}
.school-bn{font-size:12pt}
.title{font-size:13pt;font-weight:bold;margin-top:2mm;text-decoration:underline}
.sub{color:#444}
.info td{padding:1mm 0}
.marks{margin-top:3mm}
.marks th,.marks td{border:1px solid #666;padding:1.5mm;text-align:center}
.marks .subj{text-align:left}
.marks .parts{font-size:8pt;color:#555}
.marks tr.fail td{color:#b00}
.summary{margin-top:3mm}
.summary td{padding:1.5mm;border:1px solid #ccc}
.remarks{margin-top:3mm;border:1px solid #ccc;padding:2mm;min-height:10mm}
.signs{margin-top:4mm}
.signs td{text-align:center;vertical-align:bottom;height:16mm}
.sig{display:block;max-height:12mm;max-width:40mm;margin:0 auto}
.line{border-top:1px solid #000;width:45mm;margin:0 auto 1mm}
`;

const SHEET_CSS = `
body{font-size:8pt}
.head{text-align:center;margin-bottom:3mm}
.school{font-size:13pt;font-weight:bold}
.title{font-size:11pt;font-weight:bold}
.sheet th,.sheet td{border:1px solid #666;padding:1mm;text-align:center}
.sheet th{background:#eee}
.foot{margin-top:2mm;color:#666;font-size:7pt}
`;

/** Results work: tabulation, report cards and result sheets. */
@Injectable()
export class ResultJobs {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
  ) {}

  @JobHandler(QUEUES.academic, TABULATION_JOB)
  tabulate(
    payload: JobPayload<{ resultDefinitionId: string }>,
    context: JobContext,
  ) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const tabulation = await resolve(TabulationService);
      return {
        result: {
          ...(await tabulation.tabulate(payload.data.resultDefinitionId)),
        },
      };
    });
  }

  /**
   * One PDF per student (kept on the result) and one for the section,
   * merged from those without rendering again. Renders run in parallel up
   * to `PDF_CONCURRENCY`.
   */
  @JobHandler(QUEUES.pdf, REPORT_CARDS_JOB)
  reportCards(payload: JobPayload<ReportCardsJobData>, context: JobContext) {
    return this.tracker.run(payload, context, async (scope) => {
      const { resolve } = scope;
      const results = await resolve(ResultService);
      const definitions = await resolve(ResultDefinitionService);
      const settings = await resolve(SettingsService);
      const attendance = await resolve(AttendanceReportService);
      const files = await resolve(FileService);
      const { resultDefinitionId, sectionId, language } = payload.data;
      const definition = await definitions.findById(resultDefinitionId);
      const options = (await settings.getSection('results')).reportCard;
      const school = await settings.getDisplay();
      const rows = (
        await results.rows(resultDefinitionId, sectionId, null)
      ).sort((a, b) => (a.positionSection ?? 1e9) - (b.positionSection ?? 1e9));
      const l = LABELS[language];
      // One query for the whole section's attendance, not one per student.
      const summaries = options.showAttendance
        ? await attendance.enrollmentSummaries(
            definition.academicYearId,
            rows.map((r) => r.enrollmentId),
          )
        : null;
      const cards = rows.map((r) =>
        card(
          r,
          l,
          {
            ...options,
            // Bangla cards use Bangla digits; English ones the school's choice.
            numerals: language === 'bn' ? 'bn' : school.locale.numerals,
          },
          summaries?.get(r.enrollmentId) ?? null,
        ),
      );
      const images = await settings.signatureImages(options.signatureSigners);
      const page = {
        l,
        schoolName: school.name,
        schoolNameBn: school.nameBn,
        logo: null,
        resultName: definition.name,
        session: definition.academicYear?.name ?? '',
        className: definition.schoolClass?.name ?? '',
        showPoint: rows.some((r) => r.gpa !== null),
        signatures: options.signatures.map((label, i) => {
          const signer = options.signatureSigners[i] ?? null;
          return { label, image: signer ? images.get(signer) : undefined };
        }),
      };
      const render = (list: typeof cards) =>
        this.pdf.render(
          'report-cards/cards',
          { ...page, cards: list },
          { paper: 'A4', css: CARD_CSS },
        );

      // Each card renders once; the section's PDF joins those pages.
      let done = 0;
      const pdfs = await Promise.all(
        rows.map(async (r, i) => {
          const buffer = await render([cards[i]]);
          const stored = await files.storeGenerated({
            buffer,
            originalName: `report-card-${r.admissionNumber || r.enrollmentId}.pdf`,
          });
          await results.setReportCard(r.id, stored.id);
          done++;
          await scope.progress((done / Math.max(rows.length, 1)) * 90);
          return buffer;
        }),
      );
      const merged = await files.storeGenerated({
        buffer: pdfs.length ? await mergePdfs(pdfs) : await render([]),
        originalName: `report-cards-${page.className}-${rows[0]?.sectionName ?? ''}.pdf`,
      });
      return { fileId: merged.id, result: { cards: rows.length } };
    });
  }

  @JobHandler(QUEUES.exports, RESULT_EXPORT_JOB)
  exportXlsx(payload: JobPayload<ResultExportJobData>, context: JobContext) {
    return this.export(payload, context);
  }

  @JobHandler(QUEUES.pdf, RESULT_EXPORT_JOB)
  exportPdf(payload: JobPayload<ResultExportJobData>, context: JobContext) {
    return this.export(payload, context);
  }

  private export(
    payload: JobPayload<ResultExportJobData>,
    context: JobContext,
  ) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const documents = await resolve(ResultDocumentService);
      const settings = await resolve(SettingsService);
      const files = await resolve(FileService);
      const table = await documents.table(payload.data);
      const pdf = payload.data.format === 'pdf';
      const buffer = pdf
        ? await this.pdf.render(
            'results/sheet',
            {
              schoolName: (await settings.getDisplay()).name,
              title: table.title,
              subtitle: `${table.rows.length} rows`,
              headers: table.headers,
              rows: table.rows.map((r) => table.keys.map((k) => r[k] ?? '')),
              generatedAt: new Date()
                .toISOString()
                .slice(0, 16)
                .replace('T', ' '),
            },
            { paper: 'A4-landscape', margin: '8mm', css: SHEET_CSS },
          )
        : await writeSheet(
            table.keys.map((key, i) => ({ key, header: table.headers[i] })),
            table.rows,
            'Results',
          );
      const stored = await files.storeGenerated({
        buffer,
        originalName: `${payload.data.type}.${pdf ? 'pdf' : 'xlsx'}`,
      });
      return { fileId: stored.id, result: { rows: table.rows.length } };
    });
  }
}

type Labels = (typeof LABELS)[keyof typeof LABELS];

function card(
  r: ResultRow,
  l: Labels,
  options: { showPosition: boolean; showRemarks: boolean; numerals: Numerals },
  attendance: {
    days: number;
    percentage: number | null;
    present: number;
    late: number;
    halfDay: number;
  } | null,
) {
  const n = (v: number | string | null | undefined) =>
    formatNumber(v, options.numerals);
  const extra: { label: string; value: string | number }[] = [];
  if (options.showPosition) {
    if (r.positionSection !== null)
      extra.push({ label: l.sectionPosition, value: n(r.positionSection) });
    if (r.positionClass !== null)
      extra.push({ label: l.classPosition, value: n(r.positionClass) });
  }
  if (attendance && attendance.days) {
    const attended =
      attendance.present + attendance.late + attendance.halfDay / 2;
    extra.push({
      label: l.attendance,
      value: n(
        `${attended} / ${attendance.days} (${attendance.percentage ?? 0}%)`,
      ),
    });
  }
  return {
    name: r.name,
    nameBn: r.nameBn,
    admissionNumber: r.admissionNumber,
    sectionName: r.sectionName,
    rollNo: n(r.rollNo),
    total: n(r.total),
    fullMarks: n(r.fullMarks),
    gpa: r.gpa === null ? '' : n(r.gpa.toFixed(2)),
    grade: r.grade,
    outcome: r.passed ? l.passed : l.failed,
    remarks: options.showRemarks ? r.remarks : null,
    extra,
    subjects: r.subjects.map((s) => ({
      name: s.subjectName,
      isFourth: s.isFourth,
      passed: s.passed,
      parts: n(s.parts),
      fullMarks: s.exempt ? '' : n(s.fullMarks),
      obtained: s.exempt ? l.exempt : s.absent ? l.absent : n(s.marks),
      grade: s.grade ?? '',
      point: s.point === null ? '' : n(s.point.toFixed(2)),
    })),
  };
}
