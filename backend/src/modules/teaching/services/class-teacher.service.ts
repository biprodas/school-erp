import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import {
  ChangeClassTeacherDto,
  EndAssignmentDto,
} from '../dto/change-assignment.dto';
import { CreateClassTeacherDto } from '../dto/create-class-teacher.dto';
import { FilterClassTeacherDto } from '../dto/filter-class-teacher.dto';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { ClassTeacherRepository } from '../repositories/class-teacher.repository';
import {
  assertCurrent,
  assertInSession,
  changeDate,
  datedWhere,
  handoverPlan,
  invalidDate,
  NO_DATES,
  startOf,
} from './assignment-dates';
import { assertAssignable, assertNotHistory } from './assignment-rules';

/**
 * Class teachers per section, effective-dated (PRD 6.4). Changes keep
 * history: a handover ends the current row and opens a new one, ending
 * sets `effective_to`, and only current rows can be deleted (those made
 * in error).
 */
@Injectable()
export class ClassTeacherService {
  constructor(
    private readonly classTeacherRepo: ClassTeacherRepository,
    private readonly sectionService: SectionService,
    private readonly academicYearService: AcademicYearService,
    private readonly employeeService: EmployeeService,
    private readonly settings: SettingsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** `allowedSectionIds` is the caller's `AccessScope.sections(...)`. */
  findFiltered(
    filter: FilterClassTeacherDto,
    allowedSectionIds: string[] | null = null,
  ): Promise<Paginated<ClassTeacher>> {
    const base: FindOptionsWhere<ClassTeacher> = {};
    if (filter.id) base.id = filter.id;
    if (filter.sectionId) base.sectionId = filter.sectionId;
    if (filter.employeeId) base.employeeId = filter.employeeId;
    if (filter.academicYearId || filter.classId) {
      base.section = {
        academicYearId: filter.academicYearId,
        classId: filter.classId,
      };
    }
    if (allowedSectionIds !== null) {
      const ids = filter.sectionId
        ? allowedSectionIds.filter((id) => id === filter.sectionId)
        : allowedSectionIds;
      if (!ids.length) {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
        return Promise.resolve(
          new Paginated<ClassTeacher>([], 0, { page, limit }),
        );
      }
      base.sectionId = In(ids);
    }
    const where = datedWhere<ClassTeacher>(filter).map((w) => ({
      ...base,
      ...w,
    }));
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
      const section = await this.sectionService.findById(dto.sectionId);
      const year = await this.academicYearService.findById(
        section.academicYearId,
      );
      assertAssignable(await this.employeeService.findById(dto.employeeId));
      const effectiveFrom = startOf(
        dto.effectiveFrom,
        year,
        await this.settings.today(),
      );

      if (
        await this.classTeacherRepo.findCurrent(dto.sectionId, dto.employeeId)
      ) {
        throw new ConflictException({
          message: 'This employee is already a class teacher of the section',
          code: 'ASSIGNMENT_EXISTS',
        });
      }

      const isPrimary = dto.isPrimary ?? false;
      if (isPrimary) await this.classTeacherRepo.clearPrimary(dto.sectionId);

      const created = await this.classTeacherRepo.saveNew({
        sectionId: dto.sectionId,
        employeeId: dto.employeeId,
        isPrimary,
        effectiveFrom,
        effectiveTo: null,
      });
      return this.findById(created.id);
    });
  }

  /** See {@link ChangeClassTeacherDto}: a new teacher is a handover. */
  change(id: string, dto: ChangeClassTeacherDto): Promise<ClassTeacher> {
    return this.ds.runInTransaction(async () => {
      const row = await this.findById(id);
      assertCurrent(row);
      const year = row.section?.academicYear ?? NO_DATES;
      const isPrimary = dto.isPrimary ?? row.isPrimary;

      if (dto.employeeId && dto.employeeId !== row.employeeId) {
        assertAssignable(await this.employeeService.findById(dto.employeeId));
        const from = changeDate(
          dto.effectiveFrom,
          year,
          await this.settings.today(),
        );
        assertInSession(from, year);
        if (
          await this.classTeacherRepo.findCurrent(row.sectionId, dto.employeeId)
        ) {
          throw new ConflictException({
            message: 'This employee is already a class teacher of the section',
            code: 'ASSIGNMENT_EXISTS',
          });
        }

        const plan = handoverPlan(row, from);
        if (plan.kind === 'repoint') {
          if (isPrimary && !row.isPrimary) {
            await this.classTeacherRepo.clearPrimary(row.sectionId, row.id);
          }
          await this.classTeacherRepo.updateFields(row.id, {
            employeeId: dto.employeeId,
            isPrimary,
          });
          return this.findById(row.id);
        }
        // End first: the primary index only covers current rows.
        await this.classTeacherRepo.updateFields(row.id, {
          effectiveTo: plan.endOld,
        });
        if (isPrimary) await this.classTeacherRepo.clearPrimary(row.sectionId);
        const next = await this.classTeacherRepo.saveNew({
          sectionId: row.sectionId,
          employeeId: dto.employeeId,
          isPrimary,
          effectiveFrom: from,
          effectiveTo: null,
        });
        return this.findById(next.id);
      }

      if (dto.effectiveFrom) assertInSession(dto.effectiveFrom, year);
      if (isPrimary && !row.isPrimary) {
        await this.classTeacherRepo.clearPrimary(row.sectionId, row.id);
      }
      await this.classTeacherRepo.updateFields(row.id, {
        isPrimary,
        effectiveFrom: dto.effectiveFrom ?? row.effectiveFrom,
      });
      return this.findById(row.id);
    });
  }

  /** Ends a current assignment on `effectiveTo` (default today). */
  async end(id: string, dto: EndAssignmentDto): Promise<ClassTeacher> {
    const row = await this.findById(id);
    assertCurrent(row);
    const to = changeDate(
      dto.effectiveTo,
      row.section?.academicYear ?? NO_DATES,
      await this.settings.today(),
    );
    if (to < row.effectiveFrom) {
      throw invalidDate('An assignment cannot end before it starts');
    }
    await this.classTeacherRepo.updateFields(id, { effectiveTo: to });
    return this.findById(id);
  }

  /** Only for a current row created in error; ended rows are history. */
  async remove(id: string): Promise<void> {
    assertNotHistory(await this.findById(id));
    await this.classTeacherRepo.deleteById(id);
  }
}
