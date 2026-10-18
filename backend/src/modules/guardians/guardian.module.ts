import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { StudentModule } from '~/modules/students/student.module';
import { UserModule } from '~/modules/users/user.module';
import { GuardianController } from './controllers/guardian.controller';
import { GuardianRepository } from './repositories/guardian.repository';
import { GuardianService } from './services/guardian.service';
import { StudentGuardianController } from './controllers/student-guardian.controller';
import { StudentGuardianRepository } from './repositories/student-guardian.repository';

@Module({
  imports: [RbacModule, UserModule, StudentModule],
  controllers: [GuardianController, StudentGuardianController],
  providers: [GuardianRepository, StudentGuardianRepository, GuardianService],
  exports: [GuardianService],
})
export class GuardianModule {}
