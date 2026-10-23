import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CreateClassDto } from './dto/create-class.dto';
import { FilterClassDto } from './dto/filter-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Class } from './entities/class.entity';
import { ClassRepository } from './class.repository';
import { Paginated } from '~/common/dto/paginated.dto';

/**
 * Classes (grades) are permanent school records; their sections belong to
 * a session and live in `SectionModule`.
 */
@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);

  constructor(private readonly classRepo: ClassRepository) {}

  findFiltered(filter: FilterClassDto): Promise<Paginated<Class>> {
    const where: FindOptionsWhere<Class> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.classRepo.findFiltered(where, filter);
  }

  findById(id: string): Promise<Class> {
    return this.classRepo.findByIdOrFail(id);
  }

  async create(dto: CreateClassDto): Promise<Class> {
    const existing = await this.classRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Class name already in use');
    }

    return this.classRepo.saveNew({
      name: dto.name,
      code: dto.code ?? null,
      level: dto.level ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateClassDto): Promise<Class> {
    const cls = await this.findById(id);

    if (dto.name && dto.name !== cls.name) {
      const conflict = await this.classRepo.findByName(dto.name);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Class name already in use');
      }
    }

    Object.assign(cls, dto);
    return this.classRepo.save(cls);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classRepo.deleteById(id);
  }
}
