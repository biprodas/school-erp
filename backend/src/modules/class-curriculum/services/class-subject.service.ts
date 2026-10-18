import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/services/class.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { CreateClassSubjectDto } from '../dto/create-class-subject.dto';
import { FilterClassSubjectDto } from '../dto/filter-class-subject.dto';
import { UpdateClassSubjectDto } from '../dto/update-class-subject.dto';
import { ClassSubject } from '../entities/class-subject.entity';
import { ClassSubjectRepository } from '../repositories/class-subject.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class ClassSubjectService {
  private readonly logger = new Logger(ClassSubjectService.name);

  constructor(
    private readonly classSubjectRepo: ClassSubjectRepository,
    private readonly classService: ClassService,
    private readonly subjectService: SubjectService,
    private readonly academicYearService: AcademicYearService,
  ) {}

  findFiltered(
    filter: FilterClassSubjectDto,
  ): Promise<Paginated<ClassSubject>> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.subjectId) where.subjectId = filter.subjectId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.classSubjectRepo.findFiltered(where, filter);
  }

  /** Subject ids a class offers in an academic year. */
  findOfferedSubjectIds(
    classId: string,
    academicYearId: string,
  ): Promise<string[]> {
    return this.classSubjectRepo.findOfferedSubjectIds(classId, academicYearId);
  }

  async findById(id: string): Promise<ClassSubject> {
    const entity = await this.classSubjectRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`ClassSubject with id "${id}" not found`);
    }
    return entity;
  }

  async create(dto: CreateClassSubjectDto): Promise<ClassSubject> {
    await this.classService.findById(dto.classId);
    await this.subjectService.findById(dto.subjectId);
    await this.academicYearService.findById(dto.academicYearId);

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
