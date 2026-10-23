import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { PdfService } from '~/shared/pdf/pdf.service';
import { writeSheet, type SheetColumn } from '~/shared/spreadsheet/spreadsheet';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { FileService } from '~/modules/files/file.service';
import { StudentService } from './services/student.service';
import {
  STUDENT_EXPORT_JOB,
  type StudentExportInput,
} from './services/student-export.service';

interface ExportRow {
  admissionNumber: string;
  name: string;
  nameBn: string;
  gender: string;
  dob: string;
  religion: string;
  bloodGroup: string;
  phone: string;
  status: string;
}

const COLUMNS: SheetColumn<ExportRow>[] = [
  { key: 'admissionNumber', header: 'Student ID' },
  { key: 'name', header: 'Name', width: 28 },
  { key: 'nameBn', header: 'Name (Bangla)', width: 28 },
  { key: 'gender', header: 'Gender' },
  { key: 'dob', header: 'Date of birth' },
  { key: 'religion', header: 'Religion' },
  { key: 'bloodGroup', header: 'Blood group' },
  { key: 'phone', header: 'Phone' },
  { key: 'status', header: 'Status' },
];

/** Builds the export file and attaches it to the job. */
@Injectable()
export class StudentExportJob {
  constructor(
    private readonly tracker: JobTracker,
    private readonly pdf: PdfService,
  ) {}

  @JobHandler(QUEUES.exports, STUDENT_EXPORT_JOB)
  handle(payload: JobPayload<StudentExportInput>, context: JobContext) {
    return this.tracker.run(payload, context, async (scope) => {
      const { resolve } = scope;
      const { filter, allowedSectionIds, format } = payload.data;
      const students = await resolve(StudentService);
      const files = await resolve(FileService);
      const rows: ExportRow[] = (
        await students.findAllMatching(filter, allowedSectionIds)
      ).map((s) => ({
        admissionNumber: s.admissionNumber,
        name: s.fullName,
        nameBn: s.nameBn ?? '',
        gender: s.gender ?? '',
        dob: s.dob ?? '',
        religion: s.religion ?? '',
        bloodGroup: s.bloodGroup ?? '',
        phone: s.phone ?? '',
        status: s.status,
      }));
      await scope.progress(50);
      const stamp = new Date().toISOString().slice(0, 10);
      const buffer =
        format === 'pdf'
          ? await this.pdf.render(
              'students/list',
              {
                title: 'Students',
                generatedAt: stamp,
                count: rows.length,
                rows,
              },
              { paper: 'A4-landscape' },
            )
          : await writeSheet(COLUMNS, rows, 'Students');
      const stored = await files.storeGenerated({
        buffer,
        originalName: `students-${stamp}.${format}`,
      });
      return { fileId: stored.id, result: { rows: rows.length, format } };
    });
  }
}
