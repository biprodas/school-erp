import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/services/class.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SectionService } from '~/modules/sections/section.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { CreateSubjectTeacherDto } from '../dto/create-subject-teacher.dto';
import { FilterSubjectTeacherDto } from '../dto/filter-subject-teacher.dto';
import { SubjectTeacher } from '../entities/subject-teacher.entity';
import { SubjectTeacherRepository } from '../repositories/subject-teacher.repository';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class SubjectTeacherService {
  private readonly logger = new Logger(SubjectTeacherService.name);

  constructor(
    private readonly subjectTeacherRepo: SubjectTeacherRepository,
    private readonly classService: ClassService,
    private readonly sectionService: SectionService,
    private readonly subjectService: SubjectService,
    private readonly academicYearService: AcademicYearService,
    private readonly employeeService: EmployeeService,
  ) {}

  findFiltered(
    filter: FilterSubjectTeacherDto,
  ): Promise<Paginated<SubjectTeacher>> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.subjectId) where.subjectId = filter.subjectId;
    if (filter.employeeId) where.employeeId = filter.employeeId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.subjectTeacherRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<SubjectTeacher> {
    const entity = await this.subjectTeacherRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`SubjectTeacher with id "${id}" not found`);
    }
    return entity;
  }

  async create(dto: CreateSubjectTeacherDto): Promise<SubjectTeacher> {
    await this.classService.findById(dto.classId);
    await this.sectionService.findById(dto.sectionId);
    await this.subjectService.findById(dto.subjectId);
    await this.academicYearService.findById(dto.academicYearId);
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
