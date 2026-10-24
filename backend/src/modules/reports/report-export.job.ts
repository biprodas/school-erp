import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { writeSheet } from '~/shared/spreadsheet/spreadsheet';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import {
  REPORT_EXPORT_JOB,
  ReportExportService,
  type ReportExportData,
} from './services/report-export.service';

/** Writes a report export to Excel; `GET /jobs/:id` gives the link. */
@Injectable()
export class ReportExportJob {
  constructor(private readonly tracker: JobTracker) {}

  @JobHandler(QUEUES.exports, REPORT_EXPORT_JOB)
  handle(payload: JobPayload<ReportExportData>, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const exports = await resolve(ReportExportService);
      const files = await resolve(FileService);
      const { columns, rows } = await exports.table(payload.data);
      const stored = await files.storeGenerated({
        buffer: await writeSheet(columns, rows, 'Report'),
        originalName: `${payload.data.report}.xlsx`,
      });
      return { fileId: stored.id, result: { rows: rows.length } };
    });
  }
}
