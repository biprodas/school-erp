import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TenantThrottlerGuard } from '~/common/throttling/tenant-throttler.guard';
import { PlatformAuthModule } from '~/platform/auth/platform-auth.module';
import { MembershipModule } from '~/platform/memberships/membership.module';
import { OrganizationModule } from '~/platform/organizations/organization.module';
import { UserModule } from '~/platform/users/user.module';
import { TenantCleanupInterceptor } from '~/tenancy/tenant-cleanup.interceptor';
import { TenantMiddleware } from '~/tenancy/tenant.middleware';
import { ProductModule } from '~/tenanted/products/product.module';
import { RbacModule } from '~/tenanted/rbac/rbac.module';
import { StudentModule } from '~/tenanted/students/student.module';
import { DepartmentModule } from '~/tenanted/departments/department.module';
import { DesignationModule } from '~/tenanted/designations/designation.module';
import { EmployeeModule } from '~/tenanted/employees/employee.module';
import { GuardianModule } from '~/tenanted/guardians/guardian.module';
import { StakeholderModule } from '~/tenanted/stakeholders/stakeholder.module';
import { AcademicYearModule } from '~/tenanted/academic-years/academic-year.module';
import { ClassModule } from '~/tenanted/classes/class.module';
import { SectionModule } from '~/tenanted/sections/section.module';
import { SubjectModule } from '~/tenanted/subjects/subject.module';
import { SubjectGroupModule } from '~/tenanted/subject-groups/subject-group.module';
import { ClassCurriculumModule } from '~/tenanted/class-curriculum/class-curriculum.module';
import { EnrollmentModule } from '~/tenanted/enrollments/enrollment.module';
import { TeachingModule } from '~/tenanted/teaching/teaching.module';
import { TimetableModule } from '~/tenanted/timetable/timetable.module';
import { PromotionModule } from '~/tenanted/promotions/promotion.module';
import { TenantUserModule } from '~/tenanted/users/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configLoaders, envValidationSchema, ThrottleConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from '~/tenanted/auth/auth.module';
import { CatModule } from '~/tenanted/cats/cat.module';
import { TaskModule } from '~/tenanted/tasks/task.module';
import { HealthModule } from './shared/health/health.module';
import { MailModule } from './shared/mail/mail.module';
import { TenancyModule } from './tenancy/tenancy.module';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFilePath = ['.env', `.env.${nodeEnv}`];

@Module({
  imports: [
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
    DatabaseModule,
    HealthModule,
    MailModule,
    TenancyModule,
    PlatformAuthModule,
    MembershipModule,
    OrganizationModule,
    UserModule,
    AuthModule,
    TenantUserModule,
    RbacModule,
    CatModule,
    TaskModule,
    ProductModule,
    StudentModule,
    DepartmentModule,
    DesignationModule,
    EmployeeModule,
    GuardianModule,
    StakeholderModule,
    AcademicYearModule,
    SectionModule,
    SubjectModule,
    ClassModule,
    SubjectGroupModule,
    ClassCurriculumModule,
    EnrollmentModule,
    TeachingModule,
    TimetableModule,
    PromotionModule,
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
        { path: 'public', method: RequestMethod.ALL },
        { path: 'public/*path', method: RequestMethod.ALL },
        { path: 'dev/mail', method: RequestMethod.ALL },
        { path: 'dev/mail/*path', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
