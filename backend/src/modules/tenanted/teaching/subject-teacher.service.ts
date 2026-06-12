import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearRepository } from '../academic-years/academic-year.repository';
import { ClassRepository } from '../classes/class.repository';
import { EmployeeService } from '../employees/employee.service';
import { SectionRepository } from '../sections/section.repository';
import { SubjectRepository } from '../subjects/subject.repository';
import { CreateSubjectTeacherDto } from './dto/create-subject-teacher.dto';
import { FilterSubjectTeacherDto } from './dto/filter-subject-teacher.dto';
import { SubjectTeacher } from './entities/subject-teacher.entity';
import { SubjectTeacherRepository } from './subject-teacher.repository';

@Injectable()
export class SubjectTeacherService {
  private readonly logger = new Logger(SubjectTeacherService.name);

  constructor(
    private readonly subjectTeacherRepo: SubjectTeacherRepository,
    private readonly classRepo: ClassRepository,
    private readonly sectionRepo: SectionRepository,
    private readonly subjectRepo: SubjectRepository,
    private readonly academicYearRepo: AcademicYearRepository,
    private readonly employeeService: EmployeeService,
  ) {}

  async findFiltered(
    filter: FilterSubjectTeacherDto,
  ): Promise<SubjectTeacher[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.subjectId) where.subjectId = filter.subjectId;
    if (filter.employeeId) where.employeeId = filter.employeeId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.subjectTeacherRepo.findFiltered(where);
  }

  async findById(id: string): Promise<SubjectTeacher> {
    const entity = await this.subjectTeacherRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`SubjectTeacher with id "${id}" not found`);
    }
    return entity;
  }

  async create(dto: CreateSubjectTeacherDto): Promise<SubjectTeacher> {
    await this.classRepo.findByIdOrFail(dto.classId);
    await this.sectionRepo.findByIdOrFail(dto.sectionId);
    await this.subjectRepo.findByIdOrFail(dto.subjectId);
    await this.academicYearRepo.findByIdOrFail(dto.academicYearId);
    await this.employeeService.findById(dto.employeeId);

    const existing = await this.subjectTeacherRepo.findLink(
      dto.academicYearId,
      dto.classId,
      dto.sectionId,
      dto.subjectId,
      dto.employeeId,
    );
    if (existing) {
      throw new ConflictException(
        'This subject-teacher assignment already exists',
      );
    }

    const created = await this.subjectTeacherRepo.saveNew({
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      employeeId: dto.employeeId,
      academicYearId: dto.academicYearId,
    });
    return this.findById(created.id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.subjectTeacherRepo.deleteById(id);
  }
}
