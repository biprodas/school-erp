import { Injectable } from '@nestjs/common';
import { CatRepository } from './cat.repository';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { Cat } from './entities/cat.entity';
import { FilterCatDto } from './dto/filter-cat.dto';

@Injectable()
export class CatService {
  constructor(private readonly catRepo: CatRepository) {}

  async create(dto: CreateCatDto): Promise<Cat> {
    return this.catRepo.saveNew({
      name: dto.name,
      breed: dto.breed ?? null,
      age: dto.age ?? null,
    });
  }

  async findAll(filterCatDto: FilterCatDto): Promise<Cat[]> {
    const { id, name, breed } = filterCatDto;
    const where: Record<string, any> = {};
    if (id !== undefined) where.id = id;
    if (name !== undefined) where.name = name;
    if (breed !== undefined) where.breed = breed;
    return this.catRepo.findAll({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Cat> {
    return this.catRepo.findByIdOrFail(id);
  }

  async update(id: string, dto: UpdateCatDto): Promise<Cat> {
    const cat = await this.catRepo.findByIdOrFail(id);
    if (dto.name !== undefined) cat.name = dto.name;
    if (dto.breed !== undefined) cat.breed = dto.breed || null;
    if (dto.age !== undefined) cat.age = dto.age ?? null;
    return this.catRepo.save(cat);
  }

  async remove(id: string): Promise<void> {
    const cat = await this.catRepo.findByIdOrFail(id);
    await this.catRepo.remove(cat);
  }
}
