import type { Request } from 'express';
import { QUEUES, type JobQueue } from '~/shared/queue';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { JobStatus } from '../enums/job-status.enum';
import type { JobRepository } from '../repositories/job.repository';
import { JobService, type StartJobInput } from './job.service';

describe('JobService.start', () => {
  let jobRepo: { saveNew: jest.Mock; patch: jest.Mock };
  let queue: { enqueue: jest.Mock };
  let service: JobService;

  const input: StartJobInput<{ fileId: string }> = {
    type: 'students.import',
    queue: QUEUES.imports,
    name: 'students',
    data: { fileId: 'f1' },
  };

  beforeEach(() => {
    jobRepo = {
      saveNew: jest.fn().mockResolvedValue({ id: 'job-1' }),
      patch: jest.fn().mockResolvedValue(undefined),
    };
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new JobService(
      jobRepo as unknown as JobRepository,
      queue as unknown as JobQueue,
      { getDownloadUrl: jest.fn() } as never,
      fakeTenantDataSource(),
      { user: { userId: 'user-1' } } as unknown as Request,
    );
  });

  it('creates the tracking row and enqueues the job with its id', async () => {
    await expect(service.start(input)).resolves.toEqual({
      id: 'job-1',
    });
    expect(queue.enqueue).toHaveBeenCalledWith(
      'imports',
      'students',
      expect.objectContaining({ trackingId: 'job-1', actorUserId: 'user-1' }),
      { jobId: 'job-1' },
    );
    expect(jobRepo.patch).not.toHaveBeenCalled();
  });

  it('marks the row failed and rethrows when enqueueing fails', async () => {
    const err = new Error('redis down');
    queue.enqueue.mockRejectedValue(err);

    await expect(service.start(input)).rejects.toBe(err);
    expect(jobRepo.patch).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: JobStatus.FAILED }),
    );
  });
});
