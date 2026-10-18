import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CreateSectionDto } from './dto/create-section.dto';
import { FilterSectionDto } from './dto/filter-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { Section } from './entities/section.entity';
import { SectionRepository } from './section.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class SectionService {
  private readonly logger = new Logger(SectionService.name);

  constructor(private readonly sectionRepo: SectionRepository) {}

  findFiltered(filter: FilterSectionDto): Promise<Paginated<Section>> {
    const where: FindOptionsWhere<Section> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.sectionRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Section> {
    return this.sectionRepo.findByIdOrFail(id);
  }

  async create(dto: CreateSectionDto): Promise<Section> {
    const existing = await this.sectionRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Section name already in use');
    }

    return this.sectionRepo.saveNew({
      name: dto.name,
      code: dto.code ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateSectionDto): Promise<Section> {
    const section = await this.findById(id);

    if (dto.name && dto.name !== section.name) {
      const conflict = await this.sectionRepo.findByName(dto.name);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Section name already in use');
      }
    }

    Object.assign(section, dto);
    return this.sectionRepo.save(section);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.sectionRepo.deleteById(id);
  }
}
