import { Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { configLoaders } from '~/config';
import { InlineJobQueue } from './inline-job.queue';
import { JobHandler } from './job-handler.decorator';
import { JobHandlerRegistry } from './job-handler.registry';
import type { JobContext, JobPayload } from './job.types';
import { JobQueue } from './job.types';
import { QUEUES } from './queue.constants';
import { QueueModule } from './queue.module';

@Injectable()
class SampleHandlers {
  readonly seen: Array<{ payload: JobPayload; context: JobContext }> = [];
  failuresLeft = 0;

  @JobHandler(QUEUES.exports, 'sample')
  sample(payload: JobPayload, context: JobContext): Promise<void> {
    this.seen.push({ payload, context });
    if (this.failuresLeft > 0) {
      this.failuresLeft--;
      return Promise.reject(new Error('transient'));
    }
    return Promise.resolve();
  }
}

const payload = (data: unknown): JobPayload => ({
  orgId: 'org-a',
  actorUserId: 'user-1',
  data,
});

describe('QueueModule (inline driver)', () => {
  let queue: InlineJobQueue;
  let handlers: SampleHandlers;

  beforeEach(async () => {
    process.env.QUEUE_DRIVER = 'inline';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: configLoaders }), QueueModule],
      providers: [SampleHandlers],
    }).compile();
    await moduleRef.init();
    queue = moduleRef.get(JobQueue);
    handlers = moduleRef.get(SampleHandlers);
  });

  afterEach(() => {
    delete process.env.QUEUE_DRIVER;
  });

  it('uses the in-process driver', () => {
    expect(queue).toBeInstanceOf(InlineJobQueue);
  });

  it('runs a job on its discovered @JobHandler', async () => {
    await queue.enqueue(QUEUES.exports, 'sample', payload({ n: 1 }));
    expect(handlers.seen).toHaveLength(0); // not run inside enqueue
    await queue.drain();

    expect(handlers.seen).toEqual([
      {
        payload: payload({ n: 1 }),
        context: {
          queue: QUEUES.exports,
          name: 'sample',
          attempt: 1,
          attempts: 3,
        },
      },
    ]);
  });

  it('retries a failing job up to its attempts', async () => {
    handlers.failuresLeft = 2;
    await queue.enqueue(QUEUES.exports, 'sample', payload({}), {
      attempts: 3,
    });
    await queue.drain();

    expect(handlers.seen.map((s) => s.context.attempt)).toEqual([1, 2, 3]);
    expect(queue.jobs[0].error).toBeUndefined();
  });

  it('keeps the last error when every attempt fails', async () => {
    handlers.failuresLeft = 5;
    await queue.enqueue(QUEUES.exports, 'sample', payload({}), {
      attempts: 2,
    });
    await queue.drain();

    expect(queue.jobs[0].error?.message).toBe('transient');
  });

  it('drops a second job with the same jobId', async () => {
    await queue.enqueue(QUEUES.exports, 'sample', payload({}), {
      jobId: 'once',
    });
    await queue.enqueue(QUEUES.exports, 'sample', payload({}), {
      jobId: 'once',
    });
    await queue.drain();

    expect(handlers.seen).toHaveLength(1);
  });

  it('records an error for a job with no handler', async () => {
    await queue.enqueue(QUEUES.pdf, 'missing', payload({}), { attempts: 1 });
    await queue.drain();

    expect(queue.jobs[0].error?.message).toMatch(/No job handler/);
  });
});

describe('JobHandlerRegistry', () => {
  it('rejects two handlers for the same queue and name', () => {
    const registry = new JobHandlerRegistry(
      undefined as never,
      undefined as never,
      undefined as never,
    );
    registry.register(QUEUES.pdf, 'x', () => Promise.resolve());
    expect(() =>
      registry.register(QUEUES.pdf, 'x', () => Promise.resolve()),
    ).toThrow(/Duplicate/);
  });
});
