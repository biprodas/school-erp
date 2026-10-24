import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AttendanceModule } from '~/modules/attendance/attendance.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { StudentModule } from '~/modules/students/student.module';
import { StudentOverviewController } from './student-overview.controller';
import { StudentOverviewService } from './student-overview.service';

/** The student 360 view, composed from the feature modules. */
@Module({
  imports: [
    RbacModule,
    StudentModule,
    EnrollmentModule,
    GuardianModule,
    AttendanceModule,
  ],
  controllers: [StudentOverviewController],
  providers: [StudentOverviewService],
})
export class StudentOverviewModule {}
