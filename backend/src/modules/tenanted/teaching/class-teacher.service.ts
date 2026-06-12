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
import { CreateClassTeacherDto } from './dto/create-class-teacher.dto';
import { FilterClassTeacherDto } from './dto/filter-class-teacher.dto';
import { UpdateClassTeacherDto } from './dto/update-class-teacher.dto';
import { ClassTeacher } from './entities/class-teacher.entity';
import { ClassTeacherRepository } from './class-teacher.repository';

@Injectable()
export class ClassTeacherService {
  private readonly logger = new Logger(ClassTeacherService.name);

  constructor(
    private readonly classTeacherRepo: ClassTeacherRepository,
    private readonly classRepo: ClassRepository,
    private readonly sectionRepo: SectionRepository,
    private readonly academicYearRepo: AcademicYearRepository,
    private readonly employeeService: EmployeeService,
  ) {}

  async findFiltered(filter: FilterClassTeacherDto): Promise<ClassTeacher[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.employeeId) where.employeeId = filter.employeeId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.classTeacherRepo.findFiltered(where);
  }

  async findById(id: string): Promise<ClassTeacher> {
    const entity = await this.classTeacherRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`ClassTeacher with id "${id}" not found`);
    }
    return entity;
  }

  async create(dto: CreateClassTeacherDto): Promise<ClassTeacher> {
    await this.classRepo.findByIdOrFail(dto.classId);
    await this.sectionRepo.findByIdOrFail(dto.sectionId);
    await this.academicYearRepo.findByIdOrFail(dto.academicYearId);
    await this.employeeService.findById(dto.employeeId);

    const existing = await this.classTeacherRepo.findLink(
      dto.academicYearId,
      dto.classId,
      dto.sectionId,
      dto.employeeId,
    );
    if (existing) {
      throw new ConflictException(
        'This employee is already a class teacher for that class-section/year',
      );
    }

    const isPrimary = dto.isPrimary ?? false;
    if (isPrimary) {
      await this.classTeacherRepo.clearPrimary(
        dto.academicYearId,
        dto.classId,
        dto.sectionId,
      );
    }

    const created = await this.classTeacherRepo.saveNew({
      classId: dto.classId,
      sectionId: dto.sectionId,
      employeeId: dto.employeeId,
      academicYearId: dto.academicYearId,
      isPrimary,
    });
    return this.findById(created.id);
  }

  async update(id: string, dto: UpdateClassTeacherDto): Promise<ClassTeacher> {
    const entity = await this.findById(id);

    if (dto.isPrimary === true && !entity.isPrimary) {
      await this.classTeacherRepo.clearPrimary(
        entity.academicYearId,
        entity.classId,
        entity.sectionId,
        id,
      );
    }

    Object.assign(entity, dto);
    await this.classTeacherRepo.save(entity);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classTeacherRepo.deleteById(id);
  }
}
