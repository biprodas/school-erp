import { randomUUID } from 'crypto';
import { ACTIVE_SESSIONS, TEST_SESSION_ID } from './support/sessions';
import { INestApplication, Injectable, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { DepartmentRepository } from '~/modules/departments/department.repository';
import { Job } from '~/modules/jobs/entities/job.entity';
import { JobStatus } from '~/modules/jobs/enums/job-status.enum';
import { JobModule } from '~/modules/jobs/job.module';
import { JobRepository } from '~/modules/jobs/repositories/job.repository';
import { JobService } from '~/modules/jobs/services/job.service';
import { JobTracker } from '~/modules/jobs/services/job-tracker.service';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationStatus } from '~/modules/organizations/enums/organization-status.enum';
import {
  InlineJobQueue,
  JobHandler,
  JobQueue,
  QUEUES,
  type JobContext,
  type JobPayload,
} from '~/shared/queue';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';

/** What the handlers saw, for assertions. */
const seen = {
  progressMidway: [] as number[],
  departmentCounts: [] as number[],
  failedAttempts: [] as number[],
};

/** Singleton handlers, found at startup by JobHandlerRegistry. */
@Injectable()
class E2eJobHandlers {
  constructor(private readonly tracker: JobTracker) {}

  @JobHandler(QUEUES.exports, 'e2e-smoke')
  succeed(payload: JobPayload<{ echo: string }>, ctx: JobContext) {
    return this.tracker.run(payload, ctx, async (scope) => {
      await scope.progress(40);
      const jobs = await scope.resolve(JobRepository);
      const row = await jobs.findById(payload.trackingId!);
      seen.progressMidway.push(row!.progress);

      // Tenant repositories resolve for the job's school.
      const departments = await scope.resolve(DepartmentRepository);
      seen.departmentCounts.push(await departments.count());

      return { result: { echo: payload.data.echo } };
    });
  }

  @JobHandler(QUEUES.exports, 'e2e-fail')
  fail(payload: JobPayload, ctx: JobContext) {
    return this.tracker.run(payload, ctx, () => {
      seen.failedAttempts.push(ctx.attempt);
      return Promise.reject(new Error(`boom on attempt ${ctx.attempt}`));
    });
  }
}

@Module({
  imports: [JobModule],
  providers: [E2eJobHandlers],
})
class E2eJobsModule {}

interface JobBody {
  data: {
    id: string;
    status: JobStatus;
    progress: number;
    result: Record<string, unknown> | null;
  };
}

/**
 * Queue + tracked jobs (plan 4.2) with the inline driver (NODE_ENV=test):
 * `JobService.start()` creates the row and enqueues, `JobTracker.run()`
 * keeps it current through retries, and `GET /jobs/:id` shows it only to
 * its creator (or a school admin).
 */
describe('Queue and jobs (e2e)', () => {
  let app: INestApplication<App>;
  let rootDs: DataSource;
  let runner: TenantJobRunner;
  let queue: InlineJobQueue;
  let jwt: JwtService;

  const runId = randomUUID().slice(0, 8);
  const creatorId = randomUUID();
  let orgA: Organization;
  let orgB: Organization;
  let succeededJobId: string;

  const as = (org: Organization, userId: string, isAdmin = false) => {
    const token = jwt.sign({
      sub: userId,
      orgId: org.id,
      isAdmin,
      sid: TEST_SESSION_ID,
    });
    return {
      get: (url: string) =>
        request(app.getHttpServer())
          .get(url)
          .set('x-tenant-id', org.slug)
          .set('Authorization', `Bearer ${token}`),
    };
  };

  /** Starts a tracked job as `creatorId` of `org`, like a request would. */
  const startJob = (org: Organization, name: string, data: object) =>
    runner.run(
      org.id,
      async (resolve) => {
        const jobs = await resolve(JobService);
        return jobs.start({
          type: `e2e.${name}`,
          queue: QUEUES.exports,
          name,
          data,
          options: { attempts: 2 },
        });
      },
      { userId: creatorId, isAdmin: false },
    );

  const jobRow = async (id: string): Promise<Job> => {
    const job = await rootDs.getRepository(Job).findOneBy({ id });
    if (!job) throw new Error(`Job ${id} not found`);
    return job;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, E2eJobsModule],
    })
      .overrideProvider(ACTIVE_SESSIONS.provide)
      .useValue(ACTIVE_SESSIONS.useValue)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    rootDs = app.get<DataSource>(getDataSourceToken());
    runner = app.get(TenantJobRunner);
    queue = app.get<JobQueue, InlineJobQueue>(JobQueue);
    jwt = new JwtService({ secret: process.env.JWT_SECRET });

    const orgs = rootDs.getRepository(Organization);
    [orgA, orgB] = await orgs.save(
      ['a', 'b'].map((x) =>
        orgs.create({
          name: `E2E Queue ${x.toUpperCase()} ${runId}`,
          slug: `e2e-queue-${x}-${runId}`,
          status: OrganizationStatus.ACTIVE,
        }),
      ),
    );
    // Org B has a department, org A none: the job must see A's count (0).
    await runner.run(orgB.id, async (resolve) => {
      await (await resolve(DepartmentRepository)).saveNew({ name: 'Arts' });
    });
  });

  afterAll(async () => {
    await queue?.drain();
    if (rootDs?.isInitialized) {
      const ids = [orgA?.id, orgB?.id].filter(Boolean);
      if (ids.length) {
        await rootDs.getRepository(Organization).delete(ids);
      }
    }
    await app?.close();
  });

  it('uses the inline driver under NODE_ENV=test', () => {
    expect(queue).toBeInstanceOf(InlineJobQueue);
  });

  it('runs a tracked job to succeeded with progress and result stored', async () => {
    const started = await startJob(orgA, 'e2e-smoke', { echo: runId });
    expect(started).toMatchObject({
      createdBy: creatorId,
      orgId: orgA.id,
    });
    succeededJobId = started.id;

    await queue.drain();

    expect(seen.progressMidway).toEqual([40]);
    expect(seen.departmentCounts).toEqual([0]);
    const job = await jobRow(started.id);
    expect(job).toMatchObject({
      status: JobStatus.SUCCEEDED,
      progress: 100,
      result: { echo: runId },
      error: null,
      attempts: 1,
      createdBy: creatorId,
    });
    expect(job.startedAt).toBeInstanceOf(Date);
    expect(job.finishedAt).toBeInstanceOf(Date);
  });

  it('marks a job failed after its last retry', async () => {
    const started = await startJob(orgA, 'e2e-fail', {});
    await queue.drain();

    expect(seen.failedAttempts).toEqual([1, 2]);
    const job = await jobRow(started.id);
    expect(job).toMatchObject({
      status: JobStatus.FAILED,
      attempts: 2,
      // Users see a safe message; the raw error stays in the queue's record.
      error: 'The job failed',
      result: null,
    });
    expect(job.finishedAt).toBeInstanceOf(Date);

    const record = queue.jobs.find((j) => j.payload.trackingId === started.id);
    expect(record?.error?.message).toBe('boom on attempt 2');
  });

  describe('GET /jobs/:id', () => {
    it('returns the job to its creator', async () => {
      const res = await as(orgA, creatorId)
        .get(`/api/jobs/${succeededJobId}`)
        .expect(200);
      expect((res.body as JobBody).data).toMatchObject({
        id: succeededJobId,
        status: JobStatus.SUCCEEDED,
        progress: 100,
        result: { echo: runId },
      });
    });

    it('returns the job to a school admin', async () => {
      await as(orgA, randomUUID(), true)
        .get(`/api/jobs/${succeededJobId}`)
        .expect(200);
    });

    it('answers 404 to another member', async () => {
      await as(orgA, randomUUID())
        .get(`/api/jobs/${succeededJobId}`)
        .expect(404);
    });

    it('answers 404 to an admin of another school [tenant-isolation]', async () => {
      await as(orgB, randomUUID(), true)
        .get(`/api/jobs/${succeededJobId}`)
        .expect(404);
    });
  });
});
