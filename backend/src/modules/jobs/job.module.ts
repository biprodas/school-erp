import { Module } from '@nestjs/common';
import { JobController } from './controllers/job.controller';
import { JobRepository } from './repositories/job.repository';
import { JobService } from './services/job.service';
import { JobTracker } from './services/job-tracker.service';

/**
 * Tracked background jobs: `JobService.start()` from a request,
 * `JobTracker.run()` inside the `@JobHandler()`, `GET /jobs/:id` to poll.
 */
@Module({
  controllers: [JobController],
  providers: [JobRepository, JobService, JobTracker],
  exports: [JobService, JobTracker],
})
export class JobModule {}
