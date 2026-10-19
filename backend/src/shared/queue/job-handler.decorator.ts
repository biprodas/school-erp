import { SetMetadata } from '@nestjs/common';
import { JOB_HANDLER_METADATA, type QueueName } from './queue.constants';

export interface JobHandlerMetadata {
  queue: QueueName;
  name: string;
}

/**
 * Marks a method of a singleton provider as the handler for `name` jobs on
 * `queue`. The method gets `(payload, context)` (see `JobHandlerFn`). One
 * handler per queue + name; tenant work inside it goes through
 * `TenantJobRunner`.
 */
export const JobHandler = (queue: QueueName, name: string) =>
  SetMetadata(JOB_HANDLER_METADATA, {
    queue,
    name,
  } satisfies JobHandlerMetadata);
