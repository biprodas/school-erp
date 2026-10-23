import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { JobModule } from '~/modules/jobs/job.module';
import { SectionModule } from '~/modules/sections/section.module';
import { TeachingModule } from '~/modules/teaching/teaching.module';
import { RolloverController } from './rollover.controller';
import { RolloverJob } from './rollover.job';
import { RolloverService } from './rollover.service';

/** Session rollover (PRD 6.4), on top of the academic modules. */
@Module({
  imports: [
    RbacModule,
    AcademicYearModule,
    SectionModule,
    ClassCurriculumModule,
    TeachingModule,
    JobModule,
  ],
  controllers: [RolloverController],
  providers: [RolloverService, RolloverJob],
})
export class RolloverModule {}
