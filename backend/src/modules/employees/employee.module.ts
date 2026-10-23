import { Module } from '@nestjs/common';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { FileModule } from '~/modules/files/file.module';
import { NumberingModule } from '~/modules/numbering/numbering.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { UserModule } from '~/modules/users/user.module';
import { DepartmentModule } from '~/modules/departments/department.module';
import { DesignationModule } from '~/modules/designations/designation.module';
import { EmployeeController } from './employee.controller';
import { EmployeeRepository } from './employee.repository';
import { EmployeeService } from './employee.service';

@Module({
  imports: [
    RbacModule,
    AuthModule,
    UserModule,
    FileModule,
    NumberingModule,
    SettingsModule,
    DepartmentModule,
    DesignationModule,
  ],
  controllers: [EmployeeController],
  providers: [EmployeeRepository, EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
