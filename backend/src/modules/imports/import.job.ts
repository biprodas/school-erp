import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import {
  IMPORT_COMMIT_JOB,
  IMPORT_VALIDATE_JOB,
  ImportService,
} from './services/import.service';

type Payload = JobPayload<{ importId: string }>;

/** Validation and commit of imports, as the school that uploaded. */
@Injectable()
export class ImportJob {
  constructor(private readonly tracker: JobTracker) {}

  @JobHandler(QUEUES.imports, IMPORT_VALIDATE_JOB)
  validate(payload: Payload, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const imports = await resolve(ImportService);
      return { result: { ...(await imports.validate(payload.data.importId)) } };
    });
  }

  @JobHandler(QUEUES.imports, IMPORT_COMMIT_JOB)
  commit(payload: Payload, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const imports = await resolve(ImportService);
      return { result: { ...(await imports.commit(payload.data.importId)) } };
    });
  }
}
