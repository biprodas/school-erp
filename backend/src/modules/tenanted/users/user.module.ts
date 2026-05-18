import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  imports: [RbacModule],
  controllers: [UserController],
  providers: [UserRepository, UserService],
  exports: [UserService, UserRepository],
})
export class TenantUserModule {}
