import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/services/class.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SectionService } from '~/modules/sections/section.service';
import { CreateClassTeacherDto } from '../dto/create-class-teacher.dto';
import { FilterClassTeacherDto } from '../dto/filter-class-teacher.dto';
import { UpdateClassTeacherDto } from '../dto/update-class-teacher.dto';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { ClassTeacherRepository } from '../repositories/class-teacher.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class ClassTeacherService {
  private readonly logger = new Logger(ClassTeacherService.name);

  constructor(
    private readonly classTeacherRepo: ClassTeacherRepository,
    private readonly classService: ClassService,
    private readonly sectionService: SectionService,
    private readonly academicYearService: AcademicYearService,
    private readonly employeeService: EmployeeService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(
    filter: FilterClassTeacherDto,
  ): Promise<Paginated<ClassTeacher>> {
    const where: FindOptionsWhere<ClassTeacher> = {};
    if (filter.id) where.id = filter.id;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.employeeId) where.employeeId = filter.employeeId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    return this.classTeacherRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<ClassTeacher> {
    const entity = await this.classTeacherRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`ClassTeacher with id "${id}" not found`);
    }
    return entity;
  }

  create(dto: CreateClassTeacherDto): Promise<ClassTeacher> {
    return this.ds.runInTransaction(async () => {
      await this.classService.findById(dto.classId);
      await this.sectionService.findById(dto.sectionId);
      await this.academicYearService.findById(dto.academicYearId);
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
    });
  }

  update(id: string, dto: UpdateClassTeacherDto): Promise<ClassTeacher> {
    return this.ds.runInTransaction(async () => {
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
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.classTeacherRepo.deleteById(id);
  }
}
