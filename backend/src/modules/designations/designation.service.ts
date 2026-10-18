import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { FilterDesignationDto } from './dto/filter-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { Designation } from './entities/designation.entity';
import { DesignationRepository } from './designation.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class DesignationService {
  private readonly logger = new Logger(DesignationService.name);

  constructor(private readonly designationRepo: DesignationRepository) {}

  findFiltered(filter: FilterDesignationDto): Promise<Paginated<Designation>> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.title) where.title = filter.title;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.designationRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Designation> {
    return this.designationRepo.findByIdOrFail(id);
  }

  async create(dto: CreateDesignationDto): Promise<Designation> {
    const existing = await this.designationRepo.findByTitle(dto.title);
    if (existing) {
      throw new ConflictException('Designation title already in use');
    }

    return this.designationRepo.saveNew({
      title: dto.title,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateDesignationDto): Promise<Designation> {
    const designation = await this.findById(id);

    if (dto.title && dto.title !== designation.title) {
      const conflict = await this.designationRepo.findByTitle(dto.title);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Designation title already in use');
      }
    }

    Object.assign(designation, dto);
    return this.designationRepo.save(designation);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.designationRepo.deleteById(id);
  }
}
