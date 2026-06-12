import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { SubjectRepository } from '../subjects/subject.repository';
import { CreateClassSubjectDto } from './dto/create-class-subject.dto';
import { FilterClassSubjectDto } from './dto/filter-class-subject.dto';
import { UpdateClassSubjectDto } from './dto/update-class-subject.dto';
import { ClassSubject } from './entities/class-subject.entity';
import { ClassSubjectRepository } from './class-subject.repository';

@Injectable()
export class ClassSubjectService {
  private readonly logger = new Logger(ClassSubjectService.name);

  constructor(
    private readonly classSubjectRepo: ClassSubjectRepository,
    private readonly classRepo: ClassRepository,
    private readonly subjectRepo: SubjectRepository,
    private readonly academicYearRepo: AcademicYearRepository,
  ) {}

  async findFiltered(filter: FilterClassSubjectDto): Promise<ClassSubject[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.subjectId) where.subjectId = filter.subjectId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.classSubjectRepo.findFiltered(where);
  }

  async findById(id: string): Promise<ClassSubject> {
    const entity = await this.classSubjectRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`ClassSubject with id "${id}" not found`);
    }
    return entity;
  }

  async create(dto: CreateClassSubjectDto): Promise<ClassSubject> {
    await this.classRepo.findByIdOrFail(dto.classId);
    await this.subjectRepo.findByIdOrFail(dto.subjectId);
    await this.academicYearRepo.findByIdOrFail(dto.academicYearId);

    const existing = await this.classSubjectRepo.findLink(
      dto.classId,
      dto.subjectId,
      dto.academicYearId,
    );
    if (existing) {
      throw new ConflictException(
        'Subject is already offered to this class for the year',
      );
    }

    const created = await this.classSubjectRepo.saveNew({
      classId: dto.classId,
      subjectId: dto.subjectId,
      academicYearId: dto.academicYearId,
      isCompulsory: dto.isCompulsory ?? true,
      weeklyClasses: dto.weeklyClasses ?? null,
      passMarks: dto.passMarks ?? null,
      fullMarks: dto.fullMarks ?? null,
    });
    return this.findById(created.id);
  }

  async update(id: string, dto: UpdateClassSubjectDto): Promise<ClassSubject> {
    const entity = await this.findById(id);
    Object.assign(entity, dto);
    await this.classSubjectRepo.save(entity);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classSubjectRepo.deleteById(id);
  }
}
