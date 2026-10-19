import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { JobQueue, type EnqueueOptions, type QueueName } from '~/shared/queue';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { Job } from '../entities/job.entity';
import { JobRepository } from '../repositories/job.repository';

export interface StartJobInput<T> {
  /** Shown to the user and used in logs, e.g. `students.import`. */
  type: string;
  queue: QueueName;
  /** Handler name on that queue (`@JobHandler(queue, name)`). */
  name: string;
  data: T;
  options?: Omit<EnqueueOptions, 'jobId'>;
}

/** Starts tracked jobs for the current request's school and user. */
@Injectable()
export class JobService {
  constructor(
    private readonly jobRepo: JobRepository,
    private readonly queue: JobQueue,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
    @Inject(REQUEST) private readonly req: Request,
  ) {}

  /**
   * Creates the tracking row, then enqueues the job with its id. Call it
   * after the data the job needs is committed: workers read through their
   * own connection and can't see this request's open transaction.
   */
  async start<T>(input: StartJobInput<T>): Promise<Job> {
    const actorUserId = this.req.user?.userId ?? null;
    const job = await this.jobRepo.saveNew({
      type: input.type,
      createdBy: actorUserId,
    });
    await this.queue.enqueue(
      input.queue,
      input.name,
      {
        orgId: this.ds.orgId,
        actorUserId,
        trackingId: job.id,
        data: input.data,
      },
      { ...input.options, jobId: job.id },
    );
    return job;
  }

  /** The job, if the caller started it or is a school admin. */
  async findForCurrentUser(id: string): Promise<Job> {
    const job = await this.jobRepo.findById(id);
    const user = this.req.user;
    if (!job || !user || (job.createdBy !== user.userId && !user.isAdmin)) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }
}
