import { ScheduleModule } from '@nestjs/schedule';
import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TenantThrottlerGuard } from '~/common/throttling/tenant-throttler.guard';
import { AuthModule } from '~/modules/auth/auth.module';
import { MembershipModule } from '~/modules/memberships/membership.module';
import { OrganizationModule } from '~/modules/organizations/organization.module';
import { UserModule } from '~/modules/users/user.module';
import { TenantCleanupInterceptor } from '~/tenancy/tenant-cleanup.interceptor';
import { TenantMiddleware } from '~/tenancy/tenant.middleware';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { StudentModule } from '~/modules/students/student.module';
import { DepartmentModule } from '~/modules/departments/department.module';
import { DesignationModule } from '~/modules/designations/designation.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { SectionModule } from '~/modules/sections/section.module';
import { ShiftModule } from '~/modules/shifts/shift.module';
import { RoomModule } from '~/modules/rooms/room.module';
import { TermModule } from '~/modules/terms/term.module';
import { RolloverModule } from '~/modules/rollover/rollover.module';
import { GeoModule } from '~/modules/geo/geo.module';
import { CertificateModule } from '~/modules/certificates/certificate.module';
import { StudentOverviewModule } from '~/modules/student-overview/student-overview.module';
import { ImportModule } from '~/modules/imports/import.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { SubjectGroupModule } from '~/modules/subject-groups/subject-group.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { TeachingModule } from '~/modules/teaching/teaching.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { TimetableModule } from '~/modules/timetable/timetable.module';
import { PromotionModule } from '~/modules/promotions/promotion.module';
import { JobModule } from '~/modules/jobs/job.module';
import { HolidayModule } from '~/modules/holidays/holiday.module';
import { DomainEventModule } from '~/modules/domain-events/domain-event.module';
import { AttendanceModule } from '~/modules/attendance/attendance.module';
import { GradingModule } from '~/modules/grading/grading.module';
import { ExamModule } from '~/modules/exams/exam.module';
import { FeeModule } from '~/modules/fees/fee.module';
import { NotificationModule } from '~/modules/notifications/notification.module';
import { NoticeModule } from '~/modules/notices/notice.module';
import { PortalModule } from '~/modules/portal/portal.module';
import { ReportsModule } from '~/modules/reports/reports.module';
import { CacheModule } from '~/shared/cache';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configLoaders, envValidationSchema, ThrottleConfig } from '~/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from '~/shared/health/health.module';
import { LoggingModule } from '~/shared/logging/logging.module';
import { MailModule } from '~/shared/mail/mail.module';
import { QueueModule } from '~/shared/queue';
import { StorageModule } from '~/shared/storage/storage.module';
import { PdfModule } from '~/shared/pdf/pdf.module';
import { FileModule } from '~/modules/files/file.module';
import { NumberingModule } from '~/modules/numbering/numbering.module';
import { IdempotencyModule } from '~/modules/idempotency/idempotency.module';
import { TenancyModule } from '~/tenancy/tenancy.module';
import { RequestContextModule } from '~/shared/request-context/request-context.module';
import { AuditModule } from '~/modules/audit/audit.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { PlanModule } from '~/modules/plans/plan.module';
import { SignupModule } from '~/modules/signup/signup.module';
import { OnboardingModule } from '~/modules/onboarding/onboarding.module';
import { OAuthModule } from '~/modules/oauth/oauth.module';
import { HostsModule } from '~/shared/hosts/app-hosts';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFilePath = ['.env', `.env.${nodeEnv}`];

@Module({
  imports: [
    // Background jobs (e.g. the custom-domain DNS check). Off under test so
    // no job fires in the middle of a suite.
    ScheduleModule.forRoot({
      cronJobs: process.env.NODE_ENV !== 'test',
      intervals: process.env.NODE_ENV !== 'test',
      timeouts: process.env.NODE_ENV !== 'test',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validationSchema: envValidationSchema,
      load: configLoaders,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const cfg = configService.get<ThrottleConfig>('throttle')!;
        return {
          throttlers: [{ ttl: cfg.ttl, limit: cfg.limit }],
          // Kill-switch via RATE_LIMIT_ENABLED=false (e.g. load tests).
          skipIf: () => !cfg.enabled,
        };
      },
    }),
    LoggingModule,
    RequestContextModule,
    DatabaseModule,
    HealthModule,
    MailModule,
    HostsModule,
    QueueModule,
    CacheModule,
    StorageModule,
    PdfModule,
    TenancyModule,
    AuthModule,
    MembershipModule,
    OrganizationModule,
    UserModule,
    RbacModule,
    StudentModule,
    DepartmentModule,
    DesignationModule,
    EmployeeModule,
    GuardianModule,
    AcademicYearModule,
    SectionModule,
    ShiftModule,
    RoomModule,
    TermModule,
    RolloverModule,
    GeoModule,
    CertificateModule,
    StudentOverviewModule,
    ImportModule,
    SubjectModule,
    ClassModule,
    SubjectGroupModule,
    ClassCurriculumModule,
    EnrollmentModule,
    TeachingModule,
    AccessScopeModule,
    TimetableModule,
    PromotionModule,
    JobModule,
    HolidayModule,
    DomainEventModule,
    AttendanceModule,
    GradingModule,
    ExamModule,
    FeeModule,
    NotificationModule,
    NoticeModule,
    PortalModule,
    ReportsModule,
    FileModule,
    NumberingModule,
    IdempotencyModule,
    AuditModule,
    SettingsModule,
    PlanModule,
    SignupModule,
    OnboardingModule,
    OAuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: TenantThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantCleanupInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: '/', method: RequestMethod.GET },
        { path: '/info', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/*path', method: RequestMethod.ALL },
        { path: 'organizations', method: RequestMethod.ALL },
        { path: 'organizations/*path', method: RequestMethod.ALL },
        { path: 'memberships', method: RequestMethod.ALL },
        { path: 'memberships/*path', method: RequestMethod.ALL },
        { path: 'platform/auth', method: RequestMethod.ALL },
        { path: 'platform/auth/*path', method: RequestMethod.ALL },
        { path: 'platform/users', method: RequestMethod.ALL },
        { path: 'platform/users/*path', method: RequestMethod.ALL },
        { path: 'platform/audit-logs', method: RequestMethod.ALL },
        { path: 'platform/audit-logs/*path', method: RequestMethod.ALL },
        { path: 'platform/plans', method: RequestMethod.ALL },
        { path: 'platform/plans/*path', method: RequestMethod.ALL },
        { path: 'oauth', method: RequestMethod.ALL },
        { path: 'oauth/*path', method: RequestMethod.ALL },
        { path: 'public', method: RequestMethod.ALL },
        { path: 'public/*path', method: RequestMethod.ALL },
        { path: 'dev/mail', method: RequestMethod.ALL },
        { path: 'dev/mail/*path', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
