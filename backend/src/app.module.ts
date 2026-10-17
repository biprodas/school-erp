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
import { ProductModule } from '~/modules/products/product.module';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { StudentModule } from '~/modules/students/student.module';
import { DepartmentModule } from '~/modules/departments/department.module';
import { DesignationModule } from '~/modules/designations/designation.module';
import { EmployeeModule } from '~/modules/employees/employee.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { StakeholderModule } from '~/modules/stakeholders/stakeholder.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { ClassModule } from '~/modules/classes/class.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SubjectModule } from '~/modules/subjects/subject.module';
import { SubjectGroupModule } from '~/modules/subject-groups/subject-group.module';
import { ClassCurriculumModule } from '~/modules/class-curriculum/class-curriculum.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { TeachingModule } from '~/modules/teaching/teaching.module';
import { TimetableModule } from '~/modules/timetable/timetable.module';
import { PromotionModule } from '~/modules/promotions/promotion.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configLoaders, envValidationSchema, ThrottleConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { CatModule } from '~/modules/cats/cat.module';
import { TaskModule } from '~/modules/tasks/task.module';
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
    AuthModule,
    MembershipModule,
    OrganizationModule,
    UserModule,
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
