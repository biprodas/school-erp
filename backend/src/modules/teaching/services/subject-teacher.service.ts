import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import {
  ChangeAssignmentDto,
  EndAssignmentDto,
} from '../dto/change-assignment.dto';
import { CreateSubjectTeacherDto } from '../dto/create-subject-teacher.dto';
import { FilterSubjectTeacherDto } from '../dto/filter-subject-teacher.dto';
import { SubjectTeacher } from '../entities/subject-teacher.entity';
import { SubjectTeacherRepository } from '../repositories/subject-teacher.repository';
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

/** A subject's teacher in a section, effective-dated like class teachers. */
@Injectable()
export class SubjectTeacherService {
  constructor(
    private readonly subjectTeacherRepo: SubjectTeacherRepository,
    private readonly sectionService: SectionService,
    private readonly classSubjectService: ClassSubjectService,
    private readonly academicYearService: AcademicYearService,
    private readonly employeeService: EmployeeService,
    private readonly settings: SettingsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** `allowedSectionIds` is the caller's `AccessScope.sections(...)`. */
  findFiltered(
    filter: FilterSubjectTeacherDto,
    allowedSectionIds: string[] | null = null,
  ): Promise<Paginated<SubjectTeacher>> {
    const base: FindOptionsWhere<SubjectTeacher> = {};
    if (filter.id) base.id = filter.id;
    if (filter.sectionId) base.sectionId = filter.sectionId;
    if (filter.classSubjectId) base.classSubjectId = filter.classSubjectId;
    if (filter.employeeId) base.employeeId = filter.employeeId;
    if (filter.subjectId) base.classSubject = { subjectId: filter.subjectId };
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
          new Paginated<SubjectTeacher>([], 0, { page, limit }),
        );
      }
      base.sectionId = In(ids);
    }
    const where = datedWhere<SubjectTeacher>(filter).map((w) => ({
      ...base,
      ...w,
    }));
    return this.subjectTeacherRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<SubjectTeacher> {
    const entity = await this.subjectTeacherRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(`SubjectTeacher with id "${id}" not found`);
    }
    return entity;
  }

  create(dto: CreateSubjectTeacherDto): Promise<SubjectTeacher> {
    return this.ds.runInTransaction(async () => {
      const section = await this.sectionService.findById(dto.sectionId);
      const classSubject = await this.classSubjectService.findById(
        dto.classSubjectId,
      );
      this.classSubjectService.assertInSection(classSubject, section);
      const year = await this.academicYearService.findById(
        section.academicYearId,
      );
      assertAssignable(await this.employeeService.findById(dto.employeeId));
      const effectiveFrom = startOf(
        dto.effectiveFrom,
        year,
        await this.settings.today(),
      );

      await this.assertNotAssigned(
        dto.sectionId,
        dto.classSubjectId,
        dto.employeeId,
      );
      const created = await this.subjectTeacherRepo.saveNew({
        sectionId: dto.sectionId,
        classSubjectId: dto.classSubjectId,
        employeeId: dto.employeeId,
        effectiveFrom,
        effectiveTo: null,
      });
      return this.findById(created.id);
    });
  }

  /** See {@link ChangeAssignmentDto}: a new teacher is a handover. */
  change(id: string, dto: ChangeAssignmentDto): Promise<SubjectTeacher> {
    return this.ds.runInTransaction(async () => {
      const row = await this.findById(id);
      assertCurrent(row);
      const year = row.section?.academicYear ?? NO_DATES;

      if (dto.employeeId && dto.employeeId !== row.employeeId) {
        assertAssignable(await this.employeeService.findById(dto.employeeId));
        const from = changeDate(
          dto.effectiveFrom,
          year,
          await this.settings.today(),
        );
        assertInSession(from, year);
        await this.assertNotAssigned(
          row.sectionId,
          row.classSubjectId,
          dto.employeeId,
        );

        const plan = handoverPlan(row, from);
        if (plan.kind === 'repoint') {
          await this.subjectTeacherRepo.updateFields(row.id, {
            employeeId: dto.employeeId,
          });
          return this.findById(row.id);
        }
        await this.subjectTeacherRepo.updateFields(row.id, {
          effectiveTo: plan.endOld,
        });
        const next = await this.subjectTeacherRepo.saveNew({
          sectionId: row.sectionId,
          classSubjectId: row.classSubjectId,
          employeeId: dto.employeeId,
          effectiveFrom: from,
          effectiveTo: null,
        });
        return this.findById(next.id);
      }

      if (dto.effectiveFrom) {
        assertInSession(dto.effectiveFrom, year);
        await this.subjectTeacherRepo.updateFields(row.id, {
          effectiveFrom: dto.effectiveFrom,
        });
      }
      return this.findById(row.id);
    });
  }

  /** Ends a current assignment on `effectiveTo` (default today). */
  async end(id: string, dto: EndAssignmentDto): Promise<SubjectTeacher> {
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
    await this.subjectTeacherRepo.updateFields(id, { effectiveTo: to });
    return this.findById(id);
  }

  /** Only for a current row created in error; ended rows are history. */
  async remove(id: string): Promise<void> {
    assertNotHistory(await this.findById(id));
    await this.subjectTeacherRepo.deleteById(id);
  }

  private async assertNotAssigned(
    sectionId: string,
    classSubjectId: string,
    employeeId: string,
  ): Promise<void> {
    if (
      await this.subjectTeacherRepo.findCurrent(
        sectionId,
        classSubjectId,
        employeeId,
      )
    ) {
      throw new ConflictException({
        message: 'This employee already teaches the subject in the section',
        code: 'ASSIGNMENT_EXISTS',
      });
    }
  }
}
