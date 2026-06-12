import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TenantUserModule } from '../users/user.module';
import { DepartmentModule } from '../departments/department.module';
import { DesignationModule } from '../designations/designation.module';
import { EmployeeController } from './employee.controller';
import { EmployeeRepository } from './employee.repository';
import { EmployeeService } from './employee.service';

@Module({
  imports: [RbacModule, TenantUserModule, DepartmentModule, DesignationModule],
  controllers: [EmployeeController],
  providers: [EmployeeRepository, EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
