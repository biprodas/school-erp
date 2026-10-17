import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { User } from './entities/user.entity';
import { PlatformUserController } from './controllers/platform-user.controller';
import { OrgUserController } from './controllers/org-user.controller';
import { UserService } from './services/user.service';
import { OrgUserService } from './services/org-user.service';
import { AccountRepository } from './repositories/account.repository';

/**
 * Users are global accounts (one login across schools).
 * - Platform (`/platform/users`, `UserService`): manage accounts themselves.
 * - Tenant (`/users`, `OrgUserService`): members of the request's
 *   organization — accounts joined with their membership and roles.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), RbacModule],
  controllers: [PlatformUserController, OrgUserController],
  // MemberRepository comes from RbacModule (RoleService needs it too).
  providers: [UserService, OrgUserService, AccountRepository],
  exports: [UserService, OrgUserService, AccountRepository],
})
export class UserModule {}
