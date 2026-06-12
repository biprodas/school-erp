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
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { FilterTimetableDto } from './dto/filter-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { ClassTimetable } from './entities/class-timetable.entity';
import { ClassTimetableRepository } from './class-timetable.repository';
import { PeriodRepository } from './period.repository';

@Injectable()
export class ClassTimetableService {
  private readonly logger = new Logger(ClassTimetableService.name);

  constructor(
    private readonly timetableRepo: ClassTimetableRepository,
    private readonly periodRepo: PeriodRepository,
    private readonly classRepo: ClassRepository,
    private readonly sectionRepo: SectionRepository,
    private readonly subjectRepo: SubjectRepository,
    private readonly academicYearRepo: AcademicYearRepository,
    private readonly employeeService: EmployeeService,
  ) {}

  async findFiltered(filter: FilterTimetableDto): Promise<ClassTimetable[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.dayOfWeek) where.dayOfWeek = filter.dayOfWeek;
    if (filter.employeeId) where.employeeId = filter.employeeId;
    return this.timetableRepo.findFiltered(where);
  }

  async findById(id: string): Promise<ClassTimetable> {
    const entity = await this.timetableRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`Timetable entry "${id}" not found`);
    }
    return entity;
  }

  async create(dto: CreateTimetableDto): Promise<ClassTimetable> {
    await this.academicYearRepo.findByIdOrFail(dto.academicYearId);
    await this.classRepo.findByIdOrFail(dto.classId);
    await this.sectionRepo.findByIdOrFail(dto.sectionId);
    await this.periodRepo.findByIdOrFail(dto.periodId);
    await this.subjectRepo.findByIdOrFail(dto.subjectId);
    await this.employeeService.findById(dto.employeeId);

    const existing = await this.timetableRepo.findSlot(
      dto.academicYearId,
      dto.classId,
      dto.sectionId,
      dto.dayOfWeek,
      dto.periodId,
    );
    if (existing) {
      throw new ConflictException(
        'This class-section already has an entry for that day and period',
      );
    }

    const created = await this.timetableRepo.saveNew({
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      dayOfWeek: dto.dayOfWeek,
      periodId: dto.periodId,
      subjectId: dto.subjectId,
      employeeId: dto.employeeId,
    });
    return this.findById(created.id);
  }

  async update(id: string, dto: UpdateTimetableDto): Promise<ClassTimetable> {
    const entity = await this.findById(id);

    if (dto.subjectId && dto.subjectId !== entity.subjectId) {
      await this.subjectRepo.findByIdOrFail(dto.subjectId);
    }
    if (dto.employeeId && dto.employeeId !== entity.employeeId) {
      await this.employeeService.findById(dto.employeeId);
    }

    Object.assign(entity, dto);
    await this.timetableRepo.save(entity);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.timetableRepo.deleteById(id);
  }
}
