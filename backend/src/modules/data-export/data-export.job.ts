import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { FileService } from '~/modules/files/file.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { DataExportService, SCHOOL_EXPORT_JOB } from './data-export.service';

/** Builds the school export zip, stores it and emails the requester. */
@Injectable()
export class DataExportJob {
  constructor(
    private readonly tracker: JobTracker,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  @JobHandler(QUEUES.exports, SCHOOL_EXPORT_JOB)
  handle(payload: JobPayload<Record<string, never>>, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const exporter = await resolve(DataExportService);
      const files = await resolve(FileService);
      const org = await this.organizations.findOneOrFail({
        where: { id: payload.orgId! },
      });
      const { buffer, manifest } = await exporter.build();
      const stored = await files.storeGenerated({
        buffer,
        originalName: `${org.slug}-export-${manifest.exportedAt.slice(0, 10)}.zip`,
      });
      if (payload.trackingId)
        await exporter.notifyRequester(payload.trackingId, org.slug);
      return {
        fileId: stored.id,
        result: {
          tables: manifest.tables.length,
          rows: manifest.tables.reduce((n, t) => n + t.rows, 0),
        },
      };
    });
  }
}
