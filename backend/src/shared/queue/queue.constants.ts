/** Every BullMQ queue the app uses. Job handlers name one of these. */
export const QUEUES = {
  mail: 'mail',
  notifications: 'notifications',
  pdf: 'pdf',
  imports: 'imports',
  billing: 'billing',
  exports: 'exports',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Metadata key set by `@JobHandler()`. */
export const JOB_HANDLER_METADATA = 'queue:job-handler';
