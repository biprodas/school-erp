import { Injectable, Logger } from '@nestjs/common';
import { JobHandlerRegistry } from './job-handler.registry';
import { EnqueueOptions, JobPayload, JobQueue } from './job.types';
import type { QueueName } from './queue.constants';

export interface InlineJobRecord {
  queue: QueueName;
  name: string;
  payload: JobPayload;
  error?: Error;
}

/**
 * Runs jobs in-process on the next tick, with retries. Used under
 * `NODE_ENV=test` (and `QUEUE_DRIVER=inline`) so tests run real job code
 * without Redis. Await `drain()` before asserting on a job's effects.
 */
@Injectable()
export class InlineJobQueue extends JobQueue {
  private readonly logger = new Logger(InlineJobQueue.name);
  private readonly pending = new Set<Promise<void>>();
  private readonly seenJobIds = new Set<string>();
  /** Every job enqueued so far, with its final error if it failed. */
  readonly jobs: InlineJobRecord[] = [];

  constructor(private readonly registry: JobHandlerRegistry) {
    super();
  }

  enqueue<T>(
    queue: QueueName,
    name: string,
    payload: JobPayload<T>,
    options: EnqueueOptions = {},
  ): Promise<void> {
    if (options.jobId) {
      if (this.seenJobIds.has(options.jobId)) return Promise.resolve();
      this.seenJobIds.add(options.jobId);
    }
    const record: InlineJobRecord = { queue, name, payload };
    this.jobs.push(record);
    const attempts = options.attempts ?? 3;
    const run = new Promise<void>((resolve) => {
      setTimeout(() => {
        void (async () => {
          for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
              await this.registry.dispatch(payload, {
                queue,
                name,
                attempt,
                attempts,
              });
              record.error = undefined;
              break;
            } catch (err) {
              record.error = err as Error;
              if (attempt === attempts) {
                this.logger.warn(
                  `Job ${queue}:${name} failed: ${record.error.message}`,
                );
              }
            }
          }
          resolve();
        })();
      }, options.delayMs ?? 0);
    });
    this.pending.add(run);
    void run.finally(() => this.pending.delete(run));
    return Promise.resolve();
  }

  /** Resolves once every enqueued job (including ones they enqueue) is done. */
  async drain(): Promise<void> {
    while (this.pending.size) {
      await Promise.all([...this.pending]);
    }
  }
}
