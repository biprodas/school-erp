import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import type { RolloverInput } from './dto/rollover.dto';
import { ROLLOVER_JOB, RolloverService } from './rollover.service';

/** Runs queued rollovers as the school that asked (RLS applies). */
@Injectable()
export class RolloverJob {
  constructor(private readonly tracker: JobTracker) {}

  @JobHandler(QUEUES.academic, ROLLOVER_JOB)
  handle(payload: JobPayload<RolloverInput>, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const rollover = await resolve(RolloverService);
      const result = await rollover.run(payload.data);
      return { result: { ...result } };
    });
  }
}
