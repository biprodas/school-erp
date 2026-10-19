import { Injectable } from '@nestjs/common';
import type { JobContext, JobPayload } from '~/shared/queue';
import {
  TenantJobRunner,
  type TenantResolver,
} from '~/tenancy/tenant-job.runner';
import { JobStatus } from '../enums/job-status.enum';
import { JobRepository } from '../repositories/job.repository';

export interface TrackedJobScope {
  /** Resolves request-scoped providers for the job's school. */
  resolve: TenantResolver;
  /** Reports progress (0–100) on the tracking row. */
  progress(percent: number): Promise<void>;
}

export interface TrackedJobResult {
  result?: Record<string, unknown>;
  fileId?: string;
}

/**
 * Wraps a tenant job handler: runs it as the job's school (RLS applies) and
 * keeps its `jobs` row up to date: running → succeeded, or failed after the
 * last attempt (earlier failures go back to queued for the retry).
 *
 *   @JobHandler(QUEUES.imports, 'students')
 *   handle(payload: JobPayload<Input>, ctx: JobContext) {
 *     return this.tracker.run(payload, ctx, async ({ resolve, progress }) => {
 *       const students = await resolve(StudentService);
 *       …
 *       return { result: { imported } };
 *     });
 *   }
 */
@Injectable()
export class JobTracker {
  constructor(private readonly runner: TenantJobRunner) {}

  run(
    payload: JobPayload,
    context: JobContext,
    work: (scope: TrackedJobScope) => Promise<TrackedJobResult | void>,
  ): Promise<void> {
    const { orgId, actorUserId, trackingId } = payload;
    if (!orgId) {
      return Promise.reject(
        new Error(`Job ${context.queue}:${context.name} has no orgId`),
      );
    }
    return this.runner.run(
      orgId,
      async (resolve) => {
        const jobs = await resolve(JobRepository);
        const patch = (changes: Parameters<JobRepository['patch']>[1]) =>
          trackingId ? jobs.patch(trackingId, changes) : Promise.resolve();

        await patch({
          status: JobStatus.RUNNING,
          attempts: context.attempt,
          startedAt: new Date(),
          error: null,
        });
        try {
          const outcome = await work({
            resolve,
            progress: (percent) =>
              patch({
                progress: Math.max(0, Math.min(100, Math.round(percent))),
              }),
          });
          await patch({
            status: JobStatus.SUCCEEDED,
            progress: 100,
            result: outcome?.result ?? null,
            fileId: outcome?.fileId ?? null,
            finishedAt: new Date(),
          });
        } catch (err) {
          const last = context.attempt >= context.attempts;
          await patch({
            status: last ? JobStatus.FAILED : JobStatus.QUEUED,
            error: (err as Error).message,
            finishedAt: last ? new Date() : null,
          });
          throw err;
        }
      },
      actorUserId ? { userId: actorUserId, isAdmin: false } : undefined,
    );
  }
}
