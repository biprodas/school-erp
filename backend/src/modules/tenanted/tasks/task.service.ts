import { Injectable } from '@nestjs/common';
import { TaskRepository } from './task.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './entities/task-status.enum';
import { Task } from './entities/task.entity';

@Injectable()
export class TaskService {
  constructor(private readonly taskRepo: TaskRepository) {}

  async create(dto: CreateTaskDto): Promise<Task> {
    return this.taskRepo.saveNew({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.TODO,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });
  }

  async findAll(): Promise<Task[]> {
    return this.taskRepo.findAll({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Task> {
    return this.taskRepo.findByIdOrFail(id);
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findByIdOrFail(id);
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) {
      task.description = dto.description || null;
    }
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    return this.taskRepo.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.taskRepo.findByIdOrFail(id);
    await this.taskRepo.remove(task);
  }
}
