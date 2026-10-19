import { registerAs } from '@nestjs/config';

export type QueueDriver = 'bullmq' | 'inline';

export interface QueueConfig {
  /** `bullmq` uses Redis; `inline` runs jobs in-process (tests). */
  driver: QueueDriver;
  redisUrl: string;
  /** Jobs each queue's worker runs at once. */
  concurrency: number;
}

export default registerAs('queue', (): QueueConfig => ({
  driver:
    (process.env.QUEUE_DRIVER as QueueDriver | undefined) ??
    (process.env.NODE_ENV === 'test' ? 'inline' : 'bullmq'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? '4', 10),
}));
