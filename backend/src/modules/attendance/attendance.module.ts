import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { ClassModule } from '~/modules/classes/class.module';
import { DomainEventModule } from '~/modules/domain-events/domain-event.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { HolidayModule } from '~/modules/holidays/holiday.module';
import { JobModule } from '~/modules/jobs/job.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { TimetableModule } from '~/modules/timetable/timetable.module';
import { AttendanceRegisterPdfJob } from './attendance-register-pdf.job';
import { AttendanceReportController } from './controllers/attendance-report.controller';
import { AttendanceStatusController } from './controllers/attendance-status.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { StudentLeaveController } from './controllers/student-leave.controller';
import { AttendanceCorrectionRepository } from './repositories/attendance-correction.repository';
import { AttendanceRecordRepository } from './repositories/attendance-record.repository';
import { AttendanceRegisterRepository } from './repositories/attendance-register.repository';
import { AttendanceStatusRepository } from './repositories/attendance-status.repository';
import { StudentLeaveRepository } from './repositories/student-leave.repository';
import { AttendanceReportService } from './services/attendance-report.service';
import { AttendanceStatusService } from './services/attendance-status.service';
import { AttendanceUsageService } from './services/attendance-usage.service';
import { AttendanceService } from './services/attendance.service';
import { StudentLeaveService } from './services/student-leave.service';

/** Student attendance, leave and attendance reports (PRD 6.7). */
@Module({
  imports: [
    RbacModule,
    AccessScopeModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    EnrollmentModule,
    HolidayModule,
    TimetableModule,
    SettingsModule,
    DomainEventModule,
    FileModule,
    JobModule,
  ],
  controllers: [
    AttendanceController,
    AttendanceStatusController,
    AttendanceReportController,
    StudentLeaveController,
  ],
  providers: [
    AttendanceStatusRepository,
    AttendanceRegisterRepository,
    AttendanceRecordRepository,
    AttendanceCorrectionRepository,
    StudentLeaveRepository,
    AttendanceStatusService,
    AttendanceService,
    AttendanceReportService,
    AttendanceUsageService,
    StudentLeaveService,
    AttendanceRegisterPdfJob,
  ],
  exports: [
    AttendanceService,
    AttendanceReportService,
    AttendanceUsageService,
    StudentLeaveService,
  ],
})
export class AttendanceModule {}
