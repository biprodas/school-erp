import { BadRequestException } from '@nestjs/common';
import { QUEUES, type JobContext } from '~/shared/queue';
import type { TenantJobRunner } from '~/tenancy/tenant-job.runner';
import { JobStatus } from '../enums/job-status.enum';
import { JobRepository } from '../repositories/job.repository';
import { JobTracker } from './job-tracker.service';

describe('JobTracker', () => {
  let jobs: { patch: jest.Mock };
  let tracker: JobTracker;
  let logError: jest.SpyInstance;

  const context: JobContext = {
    queue: QUEUES.imports,
    name: 'students',
    attempt: 1,
    attempts: 1,
  };
  const payload = {
    orgId: 'org-a',
    actorUserId: 'user-1',
    trackingId: 'job-1',
    data: {},
  };

  const lastPatch = () =>
    jobs.patch.mock.calls[jobs.patch.mock.calls.length - 1] as [
      string,
      Record<string, unknown>,
    ];

  beforeEach(() => {
    jobs = { patch: jest.fn().mockResolvedValue(undefined) };
    const runner = {
      run: (_orgId: string, work: (resolve: unknown) => Promise<unknown>) =>
        work((token: unknown) =>
          Promise.resolve(token === JobRepository ? jobs : undefined),
        ),
    } as unknown as TenantJobRunner;
    tracker = new JobTracker(runner);
    logError = jest
      .spyOn(tracker['logger'], 'error')
      .mockImplementation(() => undefined);
  });

  it('marks the job succeeded with its result', async () => {
    await tracker.run(payload, context, () =>
      Promise.resolve({ result: { imported: 3 } }),
    );
    expect(lastPatch()).toEqual([
      'job-1',
      expect.objectContaining({
        status: JobStatus.SUCCEEDED,
        result: { imported: 3 },
      }),
    ]);
  });

  it('never stores an internal error message on the job', async () => {
    const err = new Error('duplicate key value violates "uq_students_org"');
    await expect(
      tracker.run(payload, context, () => Promise.reject(err)),
    ).rejects.toBe(err);

    expect(lastPatch()).toEqual([
      'job-1',
      expect.objectContaining({
        status: JobStatus.FAILED,
        error: 'The job failed',
      }),
    ]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('job-1'),
      err.stack,
    );
  });

  it('keeps the message of an HttpException meant for users', async () => {
    await expect(
      tracker.run(payload, context, () =>
        Promise.reject(
          new BadRequestException({ message: 'Row 4: class not found' }),
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(lastPatch()[1]).toMatchObject({ error: 'Row 4: class not found' });
  });

  it('puts the job back in the queue when more attempts remain', async () => {
    await expect(
      tracker.run(payload, { ...context, attempts: 3 }, () =>
        Promise.reject(new Error('boom')),
      ),
    ).rejects.toThrow('boom');
    expect(lastPatch()[1]).toMatchObject({
      status: JobStatus.QUEUED,
      finishedAt: null,
    });
  });
});
