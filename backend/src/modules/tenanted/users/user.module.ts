import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { UserController } from './user.controller';
import { AccountRepository } from './account.repository';
import { UserService } from './user.service';

@Module({
  imports: [RbacModule],
  controllers: [UserController],
  // MemberRepository comes from RbacModule (RoleService needs it too).
  providers: [AccountRepository, UserService],
  exports: [UserService, AccountRepository],
})
export class TenantUserModule {}
