import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { StudentModule } from '~/modules/students/student.module';
import { StudentOverviewController } from './student-overview.controller';
import { StudentOverviewService } from './student-overview.service';

/** The student 360 view, composed from the feature modules. */
@Module({
  imports: [RbacModule, StudentModule, EnrollmentModule, GuardianModule],
  controllers: [StudentOverviewController],
  providers: [StudentOverviewService],
})
export class StudentOverviewModule {}
