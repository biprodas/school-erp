import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { FilterSubjectDto } from './dto/filter-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Subject } from './entities/subject.entity';
import { SubjectType } from './enums/subject-type.enum';
import { SubjectRepository } from './subject.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class SubjectService {
  private readonly logger = new Logger(SubjectService.name);

  constructor(private readonly subjectRepo: SubjectRepository) {}

  findFiltered(filter: FilterSubjectDto): Promise<Paginated<Subject>> {
    const where: FindOptionsWhere<Subject> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.type) where.type = filter.type;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.subjectRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Subject> {
    return this.subjectRepo.findByIdOrFail(id);
  }

  async create(dto: CreateSubjectDto): Promise<Subject> {
    const existingByName = await this.subjectRepo.findByName(dto.name);
    if (existingByName) {
      throw new ConflictException('Subject name already in use');
    }
    if (dto.code) {
      const existingByCode = await this.subjectRepo.findByCode(dto.code);
      if (existingByCode) {
        throw new ConflictException('Subject code already in use');
      }
    }

    return this.subjectRepo.saveNew({
      name: dto.name,
      code: dto.code ?? null,
      type: dto.type ?? SubjectType.THEORY,
      isOptional: dto.isOptional ?? false,
      credit: dto.credit ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.findById(id);

    if (dto.name && dto.name !== subject.name) {
      const conflict = await this.subjectRepo.findByName(dto.name);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Subject name already in use');
      }
    }
    if (dto.code && dto.code !== subject.code) {
      const conflict = await this.subjectRepo.findByCode(dto.code);
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Subject code already in use');
      }
    }

    Object.assign(subject, dto);
    return this.subjectRepo.save(subject);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.subjectRepo.deleteById(id);
  }
}
