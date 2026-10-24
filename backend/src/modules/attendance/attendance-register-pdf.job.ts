import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { PdfService } from '~/shared/pdf/pdf.service';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import type { MonthlyRegisterPdfDto } from './dto/attendance-report.dto';
import { CountsAs } from './enums/attendance.enum';
import {
  AttendanceReportService,
  MONTHLY_REGISTER_JOB,
  type MonthlyRegister,
} from './services/attendance-report.service';

/** The grid's look: small type so 31 days fit a landscape page. */
const CSS = `
body{font-size:8pt}
.head{text-align:center;margin-bottom:3mm}
.school{font-size:14pt;font-weight:bold}
.school-bn{font-size:11pt}
.title{font-size:11pt;font-weight:bold;margin-top:1mm}
.meta td{padding:1mm 2mm;text-align:center}
.grid th,.grid td{border:1px solid #555;padding:.6mm .3mm;text-align:center}
.grid .roll{width:9mm}
.grid .name{text-align:left;padding-left:1.5mm;white-space:nowrap;overflow:hidden;max-width:45mm}
.grid .day,.grid .wd,.grid .cell{width:5.2mm}
.grid .wd{font-size:6pt;font-weight:normal}
.grid .sum{width:8mm;font-weight:bold}
.grid .off{background:#ddd}
.grid .absent{color:#b00;font-weight:bold}
.grid tbody tr:nth-child(5n) td{border-bottom:1.5px solid #000}
.legend{margin-top:3mm}
.legend>span{margin-right:5mm}
.signs{margin-top:14mm}
.signs td{width:50%;text-align:center}
.line{border-top:1px solid #000;width:55mm;margin:0 auto 1mm}
`;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The register's cells as the template wants them. */
export function registerTemplateData(
  register: MonthlyRegister,
  school: { name: string; nameBn: string | null },
  absentSymbols: ReadonlySet<string>,
) {
  const [y, m] = register.month.split('-').map(Number);
  return {
    schoolName: school.name,
    schoolNameBn: school.nameBn,
    className: register.section.className,
    sectionName: register.section.name,
    session: register.section.session,
    monthLabel: `${MONTHS[m - 1]} ${y}`,
    workingDays: register.days.filter((d) => d.taken).length,
    days: register.days.map((d) => ({
      ...d,
      attendedText: d.taken ? String(d.attended) : '',
    })),
    students: register.students.map((s) => ({
      ...s,
      attended: s.present + s.late + s.halfDay,
      percentage: s.percentage === null ? '' : s.percentage,
      cells: s.cells.map((text, i) => ({
        text,
        off: !!register.days[i].off,
        absent: absentSymbols.has(text),
      })),
    })),
    legend: register.legend,
  };
}

/** Renders the monthly register PDF (PRD 6.7) on the `pdf` queue. */
@Injectable()
export class AttendanceRegisterPdfJob {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
  ) {}

  @JobHandler(QUEUES.pdf, MONTHLY_REGISTER_JOB)
  handle(payload: JobPayload<MonthlyRegisterPdfDto>, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const reports = await resolve(AttendanceReportService);
      const settings = await resolve(SettingsService);
      const files = await resolve(FileService);
      const { sectionId, month, paper } = payload.data;
      const register = await reports.monthly(sectionId, month);
      const school = await settings.getDisplay();
      const absent = new Set(
        register.legend
          .filter((l) => l.countsAs === CountsAs.ABSENT)
          .map((l) => l.symbol),
      );
      const buffer = await this.pdf.render(
        'attendance/monthly-register',
        registerTemplateData(register, school, absent),
        { paper: paper ?? 'A4-landscape', margin: '8mm', css: CSS },
      );
      const stored = await files.storeGenerated({
        buffer,
        originalName: `register-${register.section.className}-${register.section.name}-${month}.pdf`,
      });
      return {
        fileId: stored.id,
        result: { students: register.students.length },
      };
    });
  }
}
