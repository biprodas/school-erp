import type { QueueName } from './queue.constants';

/**
 * What every job carries. Tenant jobs set `orgId` and run their work through
 * `TenantJobRunner`, so row-level security applies exactly as in a request.
 */
export interface JobPayload<T = unknown> {
  /** School the job works for; null for platform jobs. */
  orgId: string | null;
  /** User who started it, for audit and job ownership. */
  actorUserId: string | null;
  /** Row in `jobs` that tracks progress, when the client polls it. */
  trackingId?: string;
  data: T;
}

export interface EnqueueOptions {
  /** Deduplicates: a second job with the same id is dropped. */
  jobId?: string;
  delayMs?: number;
  /** Total tries including the first (default 3, exponential backoff). */
  attempts?: number;
}

export interface JobContext {
  queue: QueueName;
  name: string;
  /** 1 on the first try. */
  attempt: number;
  /** Total tries allowed; `attempt === attempts` is the last one. */
  attempts: number;
}

export type JobHandlerFn<T = unknown> = (
  payload: JobPayload<T>,
  context: JobContext,
) => Promise<unknown>;

/** Sends work to a queue. Request handlers only enqueue; workers run it. */
export abstract class JobQueue {
  abstract enqueue<T>(
    queue: QueueName,
    name: string,
    payload: JobPayload<T>,
    options?: EnqueueOptions,
  ): Promise<void>;
}
