import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import type { ProvisionResult } from '~/modules/auth/services/invite.service';
import { ClassService } from '~/modules/classes/class.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { ClassSubjectGroupService } from '~/modules/class-curriculum/services/class-subject-group.service';
import { FOURTH_SUBJECT_TYPES } from '~/modules/class-curriculum/enums/class-subject-type.enum';
import type { Section } from '~/modules/sections/entities/section.entity';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { SubjectService } from '~/modules/subjects/subject.service';
import { StudentService } from '~/modules/students/services/student.service';
import {
  LEAVING_STATUSES,
  StudentStatus,
} from '~/modules/students/enums/student-status.enum';
import { ChangeStudentStatusDto } from '~/modules/students/dto/change-student-status.dto';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { CreateEnrollmentDto } from '../dto/create-enrollment.dto';
import { FilterEnrollmentDto } from '../dto/filter-enrollment.dto';
import { SelectSubjectDto } from '../dto/select-subject.dto';
import { TransferEnrollmentDto } from '../dto/transfer-enrollment.dto';
import { UpdateEnrollmentDto } from '../dto/update-enrollment.dto';
import { EnrollmentChange } from '../entities/enrollment-change.entity';
import { StudentEnrollment } from '../entities/student-enrollment.entity';
import { StudentSubject } from '../entities/student-subject.entity';
import { StudentEnrollmentStatus } from '../enums/student-enrollment-status.enum';
import { EnrollmentChangeRepository } from '../repositories/enrollment-change.repository';
import { EnrollmentRepository } from '../repositories/enrollment.repository';
import { StudentSubjectRepository } from '../repositories/student-subject.repository';

/** Who may do what the caller asked (from `AccessScope.can`). */
export interface EnrollOptions {
  /** Holds `enrollments:override_capacity`. */
  canOverrideCapacity?: boolean;
}

/** An enrollment made inside a caller's transaction, mail still to send. */
export interface EnrollmentMade {
  enrollment: StudentEnrollment;
  /** The student's new portal login, if their class qualified. */
  account: ProvisionResult | null;
}

/** The enrollment status a leaving student's open enrollment gets. */
const CLOSING_STATUS: Partial<Record<StudentStatus, StudentEnrollmentStatus>> =
  {
    [StudentStatus.TRANSFERRED]: StudentEnrollmentStatus.TRANSFERRED,
    [StudentStatus.LEFT]: StudentEnrollmentStatus.LEFT,
    [StudentStatus.DROPPED_OUT]: StudentEnrollmentStatus.LEFT,
    [StudentStatus.GRADUATED]: StudentEnrollmentStatus.COMPLETED,
  };

/**
 * A student's placement per session (PRD 6.6): class, section, roll,
 * group and chosen subjects, with transfers kept as history.
 */
@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly studentSubjectRepo: StudentSubjectRepository,
    private readonly changeRepo: EnrollmentChangeRepository,
    private readonly studentService: StudentService,
    private readonly academicYearService: AcademicYearService,
    private readonly classService: ClassService,
    private readonly sectionService: SectionService,
    private readonly subjectService: SubjectService,
    private readonly classSubjectService: ClassSubjectService,
    private readonly classSubjectGroupService: ClassSubjectGroupService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  // --- Enrollment CRUD -------------------------------------------------

  /** `allowedSectionIds`: the caller's scope (null = every section). */
  findFiltered(
    filter: FilterEnrollmentDto,
    allowedSectionIds: string[] | null = null,
  ): Promise<Paginated<StudentEnrollment>> {
    const where: FindOptionsWhere<StudentEnrollment> = {};
    if (filter.id) where.id = filter.id;
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.academicYearId) where.academicYearId = filter.academicYearId;
    if (filter.classId) where.classId = filter.classId;
    if (filter.sectionId) where.sectionId = filter.sectionId;
    if (filter.status) where.status = filter.status;
    if (allowedSectionIds !== null) {
      const ids = filter.sectionId
        ? allowedSectionIds.filter((id) => id === filter.sectionId)
        : allowedSectionIds;
      if (!ids.length) {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
        return Promise.resolve(
          new Paginated<StudentEnrollment>([], 0, { page, limit }),
        );
      }
      where.sectionId = In(ids);
    }
    return this.enrollmentRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<StudentEnrollment> {
    const entity = await this.enrollmentRepo.findByIdWithRelations(id);
    if (!entity) {
      throw new NotFoundException(
        `StudentEnrollment with id "${id}" not found`,
      );
    }
    return entity;
  }

  /** A student's enrollments, newest session first (history). */
  findForStudent(studentId: string): Promise<StudentEnrollment[]> {
    return this.enrollmentRepo.findForStudent(studentId);
  }

  /** Whether a roll is taken in the section. */
  async isRollTaken(sectionId: string, rollNo: string): Promise<boolean> {
    return !!(await this.enrollmentRepo.findByRoll(sectionId, rollNo));
  }

  countActiveInSection(sectionId: string): Promise<number> {
    return this.enrollmentRepo.countActiveInSection(sectionId);
  }

  /** Active enrollments of a section, by roll (ID cards). */
  findActiveInSection(sectionId: string): Promise<StudentEnrollment[]> {
    return this.enrollmentRepo.findActiveInSection(sectionId);
  }

  /** Active enrollments of a class in a session (promotion). */
  findActiveInClass(
    academicYearId: string,
    classId: string,
  ): Promise<StudentEnrollment[]> {
    return this.enrollmentRepo.findActiveInClass(academicYearId, classId);
  }

  /** The student's enrollment in a session, if any. */
  /**
   * A class's enrollments that sit its exams: active ones, and those
   * closed at the end of the session (promoted or completed).
   */
  findExamTakers(
    academicYearId: string,
    classId: string,
  ): Promise<StudentEnrollment[]> {
    return this.enrollmentRepo.findInClass(academicYearId, classId, [
      StudentEnrollmentStatus.ACTIVE,
      StudentEnrollmentStatus.PROMOTED,
      StudentEnrollmentStatus.COMPLETED,
    ]);
  }

  /**
   * Chosen subjects per enrollment (optional, elective and 4th), as
   * subject id → whether it is the 4th subject.
   */
  async subjectChoices(
    enrollmentIds: string[],
  ): Promise<Map<string, Map<string, boolean>>> {
    const choices = new Map<string, Map<string, boolean>>();
    for (const s of await this.studentSubjectRepo.findForEnrollments(
      enrollmentIds,
    )) {
      if (!choices.has(s.studentEnrollmentId)) {
        choices.set(s.studentEnrollmentId, new Map());
      }
      choices.get(s.studentEnrollmentId)!.set(s.subjectId, s.isFourthSubject);
    }
    return choices;
  }

  /** Enrollments by id with student, class and section (reports). */
  findByIds(ids: string[]): Promise<StudentEnrollment[]> {
    return this.enrollmentRepo.findByIds(ids);
  }

  findForStudentYear(
    studentId: string,
    academicYearId: string,
  ): Promise<StudentEnrollment | null> {
    return this.enrollmentRepo.findForStudentYear(studentId, academicYearId);
  }

  async create(
    dto: CreateEnrollmentDto,
    options: EnrollOptions = {},
  ): Promise<StudentEnrollment> {
    const made = await this.ds.runInTransaction(() =>
      this.enroll(dto, options),
    );
    await made.account?.sendMail();
    return this.findById(made.enrollment.id);
  }

  /**
   * Places an active student in a section of their class and session:
   * the section must have room (unless overridden by someone allowed),
   * the roll must be free in it, and a qualifying class gives the student
   * a portal login. Joins the caller's transaction (imports, promotion).
   */
  async enroll(
    dto: CreateEnrollmentDto,
    options: EnrollOptions = {},
  ): Promise<EnrollmentMade> {
    const student = await this.studentService.findById(dto.studentId);
    if (student.status !== StudentStatus.ACTIVE) {
      throw new ConflictException({
        message: `A ${student.status} student can't be enrolled`,
        code: 'STUDENT_NOT_ACTIVE',
      });
    }
    await this.academicYearService.findById(dto.academicYearId);
    const cls = await this.classService.findById(dto.classId);
    const section = await this.assertPlacement(
      dto.academicYearId,
      dto.classId,
      dto.sectionId,
    );
    if (dto.subjectGroupId) {
      await this.assertGroupOffered(
        dto.classId,
        dto.subjectGroupId,
        dto.academicYearId,
      );
    }
    if (
      await this.enrollmentRepo.findForStudentYear(
        dto.studentId,
        dto.academicYearId,
      )
    ) {
      throw new ConflictException({
        message: 'Student is already enrolled for this academic year',
        code: 'ALREADY_ENROLLED',
      });
    }
    await this.assertRoom(section, dto.overrideCapacity, options);
    if (dto.rollNo) await this.assertRollFree(section.id, dto.rollNo);

    const enrollment = await this.enrollmentRepo.saveNew({
      studentId: dto.studentId,
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectGroupId: dto.subjectGroupId ?? null,
      rollNo: dto.rollNo ?? null,
      status: StudentEnrollmentStatus.ACTIVE,
    });
    const account = await this.studentService.ensurePortalAccount(
      dto.studentId,
      cls,
    );
    return { enrollment, account };
  }

  async update(
    id: string,
    dto: UpdateEnrollmentDto,
  ): Promise<StudentEnrollment> {
    const enrollment = await this.findById(id);

    const classId = dto.classId ?? enrollment.classId;
    if (classId !== enrollment.classId) {
      await this.classService.findById(classId);
    }
    const sectionId = dto.sectionId ?? enrollment.sectionId;
    if (classId !== enrollment.classId || dto.sectionId) {
      await this.assertPlacement(enrollment.academicYearId, classId, sectionId);
    }
    if (dto.subjectGroupId) {
      await this.assertGroupOffered(
        classId,
        dto.subjectGroupId,
        enrollment.academicYearId,
      );
    }
    const rollNo = dto.rollNo ?? enrollment.rollNo;
    if (
      rollNo &&
      (rollNo !== enrollment.rollNo || sectionId !== enrollment.sectionId)
    ) {
      await this.assertRollFree(sectionId, rollNo, id);
    }

    const { overrideCapacity: _override, ...patch } = dto;
    void _override;
    await this.enrollmentRepo.updateFields(id, patch);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.enrollmentRepo.deleteById(id);
  }

  // --- Transfers -------------------------------------------------------

  /**
   * Moves an active enrollment to another section of the same class and
   * session, recording it in `enrollment_changes` (PRD 6.6).
   */
  transfer(
    id: string,
    dto: TransferEnrollmentDto,
    options: EnrollOptions = {},
  ): Promise<StudentEnrollment> {
    return this.ds.runInTransaction(async () => {
      const enrollment = await this.findById(id);
      if (enrollment.status !== StudentEnrollmentStatus.ACTIVE) {
        throw new ConflictException({
          message: `A ${enrollment.status} enrollment can't be transferred`,
          code: 'ENROLLMENT_NOT_ACTIVE',
        });
      }
      if (dto.sectionId === enrollment.sectionId) {
        throw new BadRequestException({
          message: 'The student is already in that section',
          code: 'SAME_SECTION',
        });
      }
      const section = await this.assertPlacement(
        enrollment.academicYearId,
        enrollment.classId,
        dto.sectionId,
      );
      await this.assertRoom(section, dto.overrideCapacity, options);

      let rollNo: string | null = dto.rollNo ?? enrollment.rollNo;
      if (dto.rollNo) {
        await this.assertRollFree(section.id, dto.rollNo);
      } else if (
        rollNo &&
        (await this.enrollmentRepo.findByRoll(section.id, rollNo))
      ) {
        rollNo = null; // taken there: the school assigns a new one
      }

      const effectiveDate = dto.effectiveDate ?? (await this.settings.today());
      await this.changeRepo.saveNew({
        enrollmentId: id,
        fromSectionId: enrollment.sectionId,
        toSectionId: section.id,
        fromRollNo: enrollment.rollNo,
        reason: dto.reason ?? null,
        effectiveDate,
        changedBy: this.context.current().userId,
      });
      await this.enrollmentRepo.updateFields(id, {
        sectionId: section.id,
        rollNo,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.ENROLLMENT_TRANSFERRED,
        entityType: 'enrollment',
        entityId: id,
        before: { sectionId: enrollment.sectionId, rollNo: enrollment.rollNo },
        after: { sectionId: section.id, rollNo, effectiveDate },
      });
      return this.findById(id);
    });
  }

  async transferHistory(id: string): Promise<EnrollmentChange[]> {
    await this.findById(id);
    return this.changeRepo.findByEnrollment(id);
  }

  /** Transfers recorded against any of the enrollments (rollback checks). */
  countChanges(enrollmentIds: string[]): Promise<number> {
    return this.changeRepo.countForEnrollments(enrollmentIds);
  }

  /** Subjects chosen on any of the enrollments (rollback checks). */
  countSubjectChoices(enrollmentIds: string[]): Promise<number> {
    return this.studentSubjectRepo.countForEnrollments(enrollmentIds);
  }

  /** Writes status (and roll) of enrollments; for promotion. */
  async setStatus(id: string, status: StudentEnrollmentStatus): Promise<void> {
    await this.enrollmentRepo.updateFields(id, { status });
  }

  /** Hard-deletes enrollments a promotion created (rollback only). */
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) await this.enrollmentRepo.deleteById(id);
  }

  // --- Student status (PRD 6.6 lifecycle) ------------------------------

  /**
   * `POST /students/:id/status`: changes the student's status and closes
   * (or, on re-admission, reopens) their enrollment in the current
   * session, in one transaction.
   */
  changeStudentStatus(studentId: string, dto: ChangeStudentStatusDto) {
    return this.ds.runInTransaction(async () => {
      const change = await this.studentService.changeStatus(studentId, dto);
      const current = await this.academicYearService.findCurrent();
      const enrollment = current
        ? await this.enrollmentRepo.findForStudentYear(studentId, current.id)
        : null;
      if (enrollment) {
        const closing = CLOSING_STATUS[change.to];
        if (closing && enrollment.status === StudentEnrollmentStatus.ACTIVE) {
          await this.setStatus(enrollment.id, closing);
        } else if (
          change.to === StudentStatus.ACTIVE &&
          LEAVING_STATUSES.includes(change.from) &&
          enrollment.status !== StudentEnrollmentStatus.ACTIVE
        ) {
          await this.setStatus(enrollment.id, StudentEnrollmentStatus.ACTIVE);
        }
      }
      return change.student;
    });
  }

  // --- Subject selection (electives) -----------------------------------

  async listSubjects(enrollmentId: string): Promise<StudentSubject[]> {
    await this.findById(enrollmentId);
    return this.studentSubjectRepo.findByEnrollment(enrollmentId);
  }

  async selectSubject(
    enrollmentId: string,
    dto: SelectSubjectDto,
  ): Promise<StudentSubject> {
    const enrollment = await this.findById(enrollmentId);
    await this.subjectService.findById(dto.subjectId);

    const offered = await this.classSubjectService.findOffered(
      enrollment.classId,
      dto.subjectId,
      enrollment.academicYearId,
    );
    if (!offered) {
      throw new BadRequestException(
        'Subject is not offered to this student’s class for the year',
      );
    }
    const isFourthSubject = dto.isFourthSubject ?? false;
    if (isFourthSubject) {
      if (!FOURTH_SUBJECT_TYPES.includes(offered.subjectType)) {
        throw new BadRequestException({
          message: 'Only a 4th or optional subject can be the 4th subject',
          code: 'NOT_A_FOURTH_SUBJECT',
        });
      }
      if (await this.studentSubjectRepo.findFourthSubject(enrollmentId)) {
        throw new ConflictException({
          message: 'The student already has a 4th subject',
          code: 'FOURTH_SUBJECT_TAKEN',
        });
      }
    }

    const existing = await this.studentSubjectRepo.findLink(
      enrollmentId,
      dto.subjectId,
    );
    if (existing) {
      throw new ConflictException(
        'Subject already selected for this enrollment',
      );
    }

    const link = await this.studentSubjectRepo.saveNew({
      studentEnrollmentId: enrollmentId,
      subjectId: dto.subjectId,
      isFourthSubject,
    });
    return this.studentSubjectRepo.findByIdWithSubject(
      link.id,
    ) as Promise<StudentSubject>;
  }

  async deselectSubject(enrollmentId: string, linkId: string): Promise<void> {
    const link = await this.studentSubjectRepo.findByIdOrFail(linkId);
    if (link.studentEnrollmentId !== enrollmentId) {
      throw new NotFoundException(
        `Subject selection "${linkId}" not found for enrollment "${enrollmentId}"`,
      );
    }
    await this.studentSubjectRepo.deleteById(linkId);
  }

  // --- Checks ----------------------------------------------------------

  /** The section must be one of the class's sections in the session. */
  private async assertPlacement(
    academicYearId: string,
    classId: string,
    sectionId: string,
  ): Promise<Section> {
    const section = await this.sectionService.findById(sectionId);
    if (
      section.classId !== classId ||
      section.academicYearId !== academicYearId
    ) {
      throw new BadRequestException({
        message:
          "The section is not one of the class's sections in the session",
        code: 'SECTION_NOT_IN_CLASS',
      });
    }
    return section;
  }

  /**
   * A section with a capacity takes that many active enrollments; going
   * over needs `overrideCapacity` and `enrollments:override_capacity`.
   */
  private async assertRoom(
    section: Section,
    override: boolean | undefined,
    options: EnrollOptions,
  ): Promise<void> {
    if (section.capacity === null) return;
    const taken = await this.enrollmentRepo.countActiveInSection(section.id);
    if (taken < section.capacity) return;
    if (!override) {
      throw new ConflictException({
        message: `Section ${section.name} is full (${section.capacity})`,
        code: 'SECTION_FULL',
      });
    }
    if (!options.canOverrideCapacity) {
      throw new ForbiddenException({
        message: 'Enrolling past capacity needs the override permission',
        code: 'CAPACITY_OVERRIDE_FORBIDDEN',
      });
    }
  }

  private async assertRollFree(
    sectionId: string,
    rollNo: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.enrollmentRepo.findByRoll(sectionId, rollNo);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({
        message: `Roll ${rollNo} is taken in this section`,
        code: 'ROLL_TAKEN',
      });
    }
  }

  private async assertGroupOffered(
    classId: string,
    subjectGroupId: string,
    academicYearId: string,
  ): Promise<void> {
    if (
      !(await this.classSubjectGroupService.isOffered(
        classId,
        subjectGroupId,
        academicYearId,
      ))
    ) {
      throw new BadRequestException({
        message: 'The class does not offer this group in the session',
        code: 'GROUP_NOT_OFFERED',
      });
    }
  }
}
