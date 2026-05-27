import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PlatformAuthModule } from '~/platform/auth/platform-auth.module';
import { MembershipModule } from '~/platform/memberships/membership.module';
import { TenantModule } from '~/platform/tenants/tenant.module';
import { UserModule } from '~/platform/users/user.module';
import { TenantCleanupInterceptor } from '~/tenancy/tenant-cleanup.interceptor';
import { TenantMiddleware } from '~/tenancy/tenant.middleware';
import { ProductModule } from '~/tenanted/products/product.module';
import { RbacModule } from '~/tenanted/rbac/rbac.module';
import { StudentModule } from '~/tenanted/students/student.module';
import { TenantUserModule } from '~/tenanted/users/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configLoaders, envValidationSchema } from './config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from '~/tenanted/auth/auth.module';
import { CatModule } from '~/tenanted/cats/cat.module';
import { TaskModule } from '~/tenanted/tasks/task.module';
import { HealthModule } from './shared/health/health.module';
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
    DatabaseModule,
    HealthModule,
    TenancyModule,
    PlatformAuthModule,
    MembershipModule,
    TenantModule,
    UserModule,
    AuthModule,
    TenantUserModule,
    RbacModule,
    CatModule,
    TaskModule,
    ProductModule,
    StudentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
        { path: 'tenants', method: RequestMethod.ALL },
        { path: 'tenants/*path', method: RequestMethod.ALL },
        { path: 'memberships', method: RequestMethod.ALL },
        { path: 'memberships/*path', method: RequestMethod.ALL },
        { path: 'platform/auth', method: RequestMethod.ALL },
        { path: 'platform/auth/*path', method: RequestMethod.ALL },
        { path: 'platform/users', method: RequestMethod.ALL },
        { path: 'platform/users/*path', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
