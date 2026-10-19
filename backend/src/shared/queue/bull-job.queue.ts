import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { QueueConfig } from '~/config';
import { JobHandlerRegistry } from './job-handler.registry';
import { EnqueueOptions, JobPayload, JobQueue } from './job.types';
import type { QueueName } from './queue.constants';

/**
 * BullMQ on Redis. One `Queue` per name for producing, and one `Worker` per
 * queue that has handlers, dispatching jobs by name to `@JobHandler()`
 * methods. Failed jobs retry with exponential backoff.
 */
@Injectable()
export class BullJobQueue
  extends JobQueue
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BullJobQueue.name);
  private readonly connection: IORedis;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Worker[] = [];

  constructor(
    private readonly config: QueueConfig,
    private readonly registry: JobHandlerRegistry,
  ) {
    super();
    // BullMQ workers need `maxRetriesPerRequest: null` (blocking commands).
    this.connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  async enqueue<T>(
    queue: QueueName,
    name: string,
    payload: JobPayload<T>,
    options: EnqueueOptions = {},
  ): Promise<void> {
    await this.queue(queue).add(name, payload, {
      jobId: options.jobId,
      delay: options.delayMs,
      attempts: options.attempts ?? 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  onApplicationBootstrap(): void {
    for (const name of this.registry.queues()) {
      const worker = new Worker(
        name,
        (job) =>
          this.registry.dispatch(job.data as JobPayload, {
            queue: name,
            name: job.name,
            attempt: job.attemptsMade + 1,
            attempts: job.opts.attempts ?? 1,
          }),
        {
          connection: this.connection,
          concurrency: this.config.concurrency,
        },
      );
      worker.on('failed', (job, err) =>
        this.logger.warn(
          `Job ${name}:${job?.name ?? '?'} (${job?.id ?? '?'}) failed: ${err.message}`,
        ),
      );
      this.workers.push(worker);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection.quit().catch(() => undefined);
  }

  private queue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.connection,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }
}
