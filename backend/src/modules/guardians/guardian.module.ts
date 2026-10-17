import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { StudentModule } from '../students/student.module';
import { TenantUserModule } from '../users/user.module';
import { GuardianController } from './guardian.controller';
import { GuardianRepository } from './guardian.repository';
import { GuardianService } from './guardian.service';
import { StudentGuardianController } from './student-guardian.controller';
import { StudentGuardianRepository } from './student-guardian.repository';

@Module({
  imports: [RbacModule, TenantUserModule, StudentModule],
  controllers: [GuardianController, StudentGuardianController],
  providers: [GuardianRepository, StudentGuardianRepository, GuardianService],
  exports: [GuardianService],
})
export class GuardianModule {}
