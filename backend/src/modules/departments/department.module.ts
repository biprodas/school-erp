import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { DepartmentController } from './department.controller';
import { DepartmentRepository } from './department.repository';
import { DepartmentService } from './department.service';

@Module({
  imports: [RbacModule],
  controllers: [DepartmentController],
  providers: [DepartmentRepository, DepartmentService],
  exports: [DepartmentService, DepartmentRepository],
})
export class DepartmentModule {}
