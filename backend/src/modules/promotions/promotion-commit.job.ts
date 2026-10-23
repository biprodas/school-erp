import { Injectable } from '@nestjs/common';
import { JobHandler, QUEUES } from '~/shared/queue';
import type { JobContext, JobPayload } from '~/shared/queue';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import {
  PROMOTION_COMMIT_JOB,
  PromotionService,
} from './services/promotion.service';

/** Commits a promotion batch as the school that asked (RLS applies). */
@Injectable()
export class PromotionCommitJob {
  constructor(private readonly tracker: JobTracker) {}

  @JobHandler(QUEUES.academic, PROMOTION_COMMIT_JOB)
  handle(payload: JobPayload<{ batchId: string }>, context: JobContext) {
    return this.tracker.run(payload, context, async ({ resolve }) => {
      const promotions = await resolve(PromotionService);
      return { result: await promotions.commit(payload.data.batchId) };
    });
  }
}
