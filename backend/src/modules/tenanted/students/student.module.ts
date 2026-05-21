import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TenantUserModule } from '../users/user.module';
import { StudentController } from './student.controller';
import { StudentRepository } from './student.repository';
import { StudentService } from './student.service';

@Module({
  imports: [RbacModule, TenantUserModule],
  controllers: [StudentController],
  providers: [StudentRepository, StudentService],
  exports: [StudentService],
})
export class StudentModule {}
