import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { AttendanceModule } from '~/modules/attendance/attendance.module';
import { ExamModule } from '~/modules/exams/exam.module';
import { JobModule } from '~/modules/jobs/job.module';
import { SectionModule } from '~/modules/sections/section.module';
import { StudentModule } from '~/modules/students/student.module';
import { PromotionController } from './controllers/promotion.controller';
import { PromotionCommitJob } from './promotion-commit.job';
import { PromotionBatchItemRepository } from './repositories/promotion-batch-item.repository';
import { PromotionBatchRepository } from './repositories/promotion-batch.repository';
import { PromotionService } from './services/promotion.service';

@Module({
  imports: [
    RbacModule,
    StudentModule,
    EnrollmentModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    JobModule,
    AttendanceModule,
    ExamModule,
  ],
  controllers: [PromotionController],
  providers: [
    PromotionBatchRepository,
    PromotionBatchItemRepository,
    PromotionService,
    PromotionCommitJob,
  ],
  exports: [PromotionService],
})
export class PromotionModule {}
