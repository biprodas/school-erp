import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { AttendanceModule } from '~/modules/attendance/attendance.module';
import { ClassModule } from '~/modules/classes/class.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { ExamModule } from '~/modules/exams/exam.module';
import { FeeModule } from '~/modules/fees/fee.module';
import { FileModule } from '~/modules/files/file.module';
import { HolidayModule } from '~/modules/holidays/holiday.module';
import { JobModule } from '~/modules/jobs/job.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import {
  DashboardController,
  ReportExportController,
} from './controllers/dashboard.controller';
import { ReportExportJob } from './report-export.job';
import { DashboardService } from './services/dashboard.service';
import { ReportExportService } from './services/report-export.service';

/** Role dashboards and background report exports (PRD 6.22). */
@Module({
  imports: [
    RbacModule,
    AccessScopeModule,
    AcademicYearModule,
    ClassModule,
    EnrollmentModule,
    EmployeeModule,
    AttendanceModule,
    HolidayModule,
    ExamModule,
    FeeModule,
    SettingsModule,
    FileModule,
    JobModule,
  ],
  controllers: [DashboardController, ReportExportController],
  providers: [DashboardService, ReportExportService, ReportExportJob],
})
export class ReportsModule {}
