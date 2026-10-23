import { Injectable } from '@nestjs/common';
import { QUEUES } from '~/shared/queue';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { SectionService } from '~/modules/sections/section.service';

export const ID_CARDS_JOB = 'id-cards';

/** Bulk ID cards per section (PRD 6.6): one fixed layout, photo and QR. */
@Injectable()
export class IdCardService {
  constructor(
    private readonly sections: SectionService,
    private readonly jobs: JobService,
  ) {}

  async start(sectionId: string): Promise<Job> {
    await this.sections.findById(sectionId);
    return this.jobs.start<{ sectionId: string }>({
      type: 'students.id_cards',
      queue: QUEUES.pdf,
      name: ID_CARDS_JOB,
      data: { sectionId },
    });
  }
}
