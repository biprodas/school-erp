import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { FilterDepartmentDto } from './dto/filter-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department } from './entities/department.entity';
import { DepartmentRepository } from './department.repository';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(private readonly departmentRepo: DepartmentRepository) {}

  async findFiltered(filter: FilterDepartmentDto): Promise<Department[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.departmentRepo.findFiltered(where);
  }

  async findById(id: string): Promise<Department> {
    return this.departmentRepo.findByIdOrFail(id);
  }

  async create(dto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.departmentRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Department name already in use');
    }

    return this.departmentRepo.saveNew({
      name: dto.name,
      code: dto.code ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findById(id);

    if (dto.name && dto.name !== department.name) {
      const conflict = await this.departmentRepo.findByName(dto.name);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Department name already in use');
      }
    }

    Object.assign(department, dto);
    return this.departmentRepo.save(department);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.departmentRepo.deleteById(id);
  }
}
