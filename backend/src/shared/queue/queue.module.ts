import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import type { QueueConfig } from '~/config';
import { BullJobQueue } from './bull-job.queue';
import { InlineJobQueue } from './inline-job.queue';
import { JobHandlerRegistry } from './job-handler.registry';
import { JobQueue } from './job.types';

/**
 * Background jobs. Inject `JobQueue` to enqueue; mark handlers with
 * `@JobHandler(queue, name)` on a singleton provider. The driver comes from
 * `QUEUE_DRIVER`: BullMQ on Redis by default, in-process under tests.
 */
@Global()
@Module({
  imports: [ConfigModule, DiscoveryModule],
  providers: [
    JobHandlerRegistry,
    {
      provide: JobQueue,
      inject: [ConfigService, JobHandlerRegistry],
      useFactory: (config: ConfigService, registry: JobHandlerRegistry) => {
        const cfg = config.get<QueueConfig>('queue')!;
        return cfg.driver === 'inline'
          ? new InlineJobQueue(registry)
          : new BullJobQueue(cfg, registry);
      },
    },
  ],
  exports: [JobQueue],
})
export class QueueModule {}
