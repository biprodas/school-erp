import { PlanModule } from '~/modules/plans/plan.module';
import { Module } from '@nestjs/common';
import { SessionModule } from '~/modules/auth/session.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { User } from './entities/user.entity';
import { PlatformUserController } from './controllers/platform-user.controller';
import { OrgUserController } from './controllers/org-user.controller';
import { UserService } from './services/user.service';
import { OrgUserService } from './services/org-user.service';
import { UserRoleController } from './controllers/user-role.controller';
import { AccountRepository } from './repositories/account.repository';
import { MemberRepository } from './repositories/member.repository';

/**
 * Users are global accounts (one login across schools).
 * - Platform (`/platform/users`, `UserService`): manage accounts themselves.
 * - Tenant (`/users`, `OrgUserService`): members of the request's
 *   organization — accounts joined with their membership and roles
 *   (`/users/:userId/roles`).
 *
 * The two identity repositories are exported for AuthModule only: sign-in
 * and password flows need password-selecting queries that don't belong on a
 * general service. Other modules use the services.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    RbacModule,
    SessionModule,
    PlanModule,
  ],
  controllers: [PlatformUserController, OrgUserController, UserRoleController],
  providers: [UserService, OrgUserService, AccountRepository, MemberRepository],
  exports: [UserService, OrgUserService, AccountRepository, MemberRepository],
})
export class UserModule {}
