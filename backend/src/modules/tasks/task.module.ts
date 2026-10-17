import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repository';
import { TaskService } from './task.service';

@Module({
  imports: [RbacModule],
  controllers: [TaskController],
  providers: [TaskRepository, TaskService],
  exports: [TaskService],
})
export class TaskModule {}
