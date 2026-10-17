import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SectionRepository } from '../sections/section.repository';
import { AttachSectionDto } from './dto/attach-section.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { FilterClassDto } from './dto/filter-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { Class } from './entities/class.entity';
import { ClassSection } from './entities/class-section.entity';
import { ClassRepository } from './class.repository';
import { ClassSectionRepository } from './class-section.repository';

@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);

  constructor(
    private readonly classRepo: ClassRepository,
    private readonly classSectionRepo: ClassSectionRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  // --- Class CRUD ------------------------------------------------------

  async findFiltered(filter: FilterClassDto): Promise<Class[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.name) where.name = filter.name;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.classRepo.findFiltered(where);
  }

  async findById(id: string): Promise<Class> {
    const cls = await this.classRepo.findByIdWithSections(id);
    if (!cls) {
      throw new NotFoundException(`Class with id "${id}" not found`);
    }
    return cls;
  }

  async create(dto: CreateClassDto): Promise<Class> {
    const existing = await this.classRepo.findByName(dto.name);
    if (existing) {
      throw new ConflictException('Class name already in use');
    }

    const cls = await this.classRepo.saveNew({
      name: dto.name,
      code: dto.code ?? null,
      level: dto.level ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.findById(cls.id);
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
    await this.classRepo.save(cls);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classRepo.deleteById(id);
  }

  // --- Class <-> Section links -----------------------------------------

  async listSections(classId: string): Promise<ClassSection[]> {
    await this.findById(classId);
    return this.classSectionRepo.findByClass(classId);
  }

  async attachSection(
    classId: string,
    dto: AttachSectionDto,
  ): Promise<ClassSection> {
    await this.findById(classId);
    await this.sectionRepo.findByIdOrFail(dto.sectionId);

    const existing = await this.classSectionRepo.findLink(
      classId,
      dto.sectionId,
    );
    if (existing) {
      throw new ConflictException('Section is already attached to this class');
    }

    const link = await this.classSectionRepo.saveNew({
      classId,
      sectionId: dto.sectionId,
      capacity: dto.capacity ?? null,
      isActive: true,
    });
    return this.classSectionRepo.findByIdWithSection(
      link.id,
    ) as Promise<ClassSection>;
  }

  async updateSection(
    classId: string,
    linkId: string,
    dto: UpdateClassSectionDto,
  ): Promise<ClassSection> {
    const link = await this.getLinkOrFail(classId, linkId);

    Object.assign(link, dto);
    await this.classSectionRepo.save(link);
    return this.classSectionRepo.findByIdWithSection(
      linkId,
    ) as Promise<ClassSection>;
  }

  async detachSection(classId: string, linkId: string): Promise<void> {
    await this.getLinkOrFail(classId, linkId);
    await this.classSectionRepo.deleteById(linkId);
  }

  private async getLinkOrFail(
    classId: string,
    linkId: string,
  ): Promise<ClassSection> {
    const link = await this.classSectionRepo.findByIdOrFail(linkId);
    if (link.classId !== classId) {
      throw new NotFoundException(
        `Section link "${linkId}" not found for class "${classId}"`,
      );
    }
    return link;
  }
}
