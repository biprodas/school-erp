import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { SubjectGroupRepository } from '../subject-groups/subject-group.repository';
import { CreateClassSubjectGroupDto } from './dto/create-class-subject-group.dto';
import { FilterClassSubjectGroupDto } from './dto/filter-class-subject-group.dto';
import { ClassSubjectGroup } from './entities/class-subject-group.entity';
import { ClassSubjectGroupRepository } from './class-subject-group.repository';

@Injectable()
export class ClassSubjectGroupService {
  private readonly logger = new Logger(ClassSubjectGroupService.name);

  constructor(
    private readonly classSubjectGroupRepo: ClassSubjectGroupRepository,
    private readonly classRepo: ClassRepository,
    private readonly subjectGroupRepo: SubjectGroupRepository,
    private readonly academicYearRepo: AcademicYearRepository,
  ) {}

  async findFiltered(
    filter: FilterClassSubjectGroupDto,
  ): Promise<ClassSubjectGroup[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.subjectGroupId) where.subjectGroupId = filter.subjectGroupId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.classSubjectGroupRepo.findFiltered(where);
  }

  async findById(id: string): Promise<ClassSubjectGroup> {
    const entity = await this.classSubjectGroupRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(
        `ClassSubjectGroup with id "${id}" not found`,
      );
    }
    return entity;
  }

  async create(dto: CreateClassSubjectGroupDto): Promise<ClassSubjectGroup> {
    await this.classRepo.findByIdOrFail(dto.classId);
    await this.subjectGroupRepo.findByIdOrFail(dto.subjectGroupId);
    await this.academicYearRepo.findByIdOrFail(dto.academicYearId);

    const existing = await this.classSubjectGroupRepo.findLink(
      dto.classId,
      dto.subjectGroupId,
      dto.academicYearId,
    );
    if (existing) {
      throw new ConflictException(
        'Subject group is already offered to this class for the year',
      );
    }

    const created = await this.classSubjectGroupRepo.saveNew({
      classId: dto.classId,
      subjectGroupId: dto.subjectGroupId,
      academicYearId: dto.academicYearId,
    });
    return this.findById(created.id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classSubjectGroupRepo.deleteById(id);
  }
}
