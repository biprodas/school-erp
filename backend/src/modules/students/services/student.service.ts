import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { normalizePhone } from '~/common/identity/identifier';
import { Paginated } from '~/common/dto/paginated.dto';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import {
  InviteService,
  type ProvisionResult,
} from '~/modules/auth/services/invite.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import type { Class } from '~/modules/classes/entities/class.entity';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import { NumberingService } from '~/modules/numbering/numbering.service';
import {
  patternScope,
  usesClassCode,
} from '~/modules/numbering/numbering-pattern';
import { EntitlementService } from '~/modules/plans/services/entitlement.service';
import { STUDENT_ROLE_NAME } from '~/modules/rbac/system-roles.seed';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { ChangeStudentStatusDto } from '../dto/change-student-status.dto';
import { CreateStudentDto } from '../dto/create-student.dto';
import { FilterStudentDto } from '../dto/filter-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { Student } from '../entities/student.entity';
import { StudentStatusHistory } from '../entities/student-status-history.entity';
import {
  STATUS_TRANSITIONS,
  StudentStatus,
} from '../enums/student-status.enum';
import { StudentStatusHistoryRepository } from '../repositories/student-status-history.repository';
import {
  StudentRepository,
  type StudentSearch,
} from '../repositories/student.repository';

/** Counter key in `numbering_sequences` for generated student IDs. */
export const STUDENT_ID_KEY = 'student';

/** A session id nothing has: class filters without a current session. */
const NO_SESSION = '00000000-0000-0000-0000-000000000000';

/** Generated IDs skipped because someone typed them in by hand. */
const MAX_ID_ATTEMPTS = 20;

/** Where a new student is placed, for the ID pattern (`{YY}`, `{CLASS}`). */
export interface AdmissionContext {
  classId?: string;
  /** The day `{YY}` comes from (default: admission date, else today). */
  date?: string;
}

/** The outcome of a status change (callers close enrollments with it). */
export interface StatusChange {
  student: Student;
  from: StudentStatus;
  to: StudentStatus;
  effectiveDate: string;
}

/** The class code `{CLASS}` renders: the class's code, else its level. */
export function classCode(cls: Pick<Class, 'code' | 'level'>): string | null {
  if (cls.code) return cls.code;
  return cls.level === null ? null : String(cls.level).padStart(2, '0');
}

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly historyRepo: StudentStatusHistoryRepository,
    private readonly classService: ClassService,
    private readonly academicYears: AcademicYearService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly files: FileService,
    private readonly invites: InviteService,
    private readonly entitlements: EntitlementService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /**
   * The student list and search (PRD 6.6). `allowedSectionIds` is the
   * caller's `AccessScope.sections(...)`; class/section filters apply to
   * the given session, else the current one.
   */
  async findFiltered(
    filter: FilterStudentDto,
    allowedSectionIds: string[] | null = null,
  ): Promise<Paginated<Student>> {
    return this.studentRepo.search(
      await this.criteria(filter, allowedSectionIds),
      filter,
    );
  }

  /** Every match, page by page (exports). */
  async findAllMatching(
    filter: FilterStudentDto,
    allowedSectionIds: string[] | null,
  ): Promise<Student[]> {
    const criteria = await this.criteria(filter, allowedSectionIds);
    const items: Student[] = [];
    for (let page = 1; ; page++) {
      const result = await this.studentRepo.search(criteria, {
        page,
        limit: 100,
      });
      items.push(...result.items);
      if (page >= result.meta.totalPages) return items;
    }
  }

  async findById(id: string): Promise<Student> {
    return this.studentRepo.findByIdOrFail(id);
  }

  findByAdmissionNumber(admissionNumber: string): Promise<Student | null> {
    return this.studentRepo.findByAdmissionNumber(admissionNumber);
  }

  /** Whether typing student IDs is allowed here (`numbering`). */
  async allowsManualId(): Promise<boolean> {
    return (await this.settings.getSection('numbering')).allowManualStudentId;
  }

  /** Whether the student is enrolled in one of these sections. */
  isInSections(studentId: string, sectionIds: string[]): Promise<boolean> {
    return this.studentRepo.isInSections(studentId, sectionIds);
  }

  /**
   * Adds a student (status `active`) with an ID from the school's pattern,
   * or the one typed in where the school allows it. Joins the caller's
   * transaction (imports).
   */
  async create(
    dto: CreateStudentDto,
    admission: AdmissionContext = {},
  ): Promise<Student> {
    // The plan's active-student limit (PRD 3.3); a soft limit, checked on
    // committed rows.
    await this.entitlements.assertLimit(this.ds.orgId, 'students');
    return this.ds.runInTransaction(async () => {
      const admissionNumber = dto.admissionNumber
        ? await this.manualNumber(dto.admissionNumber)
        : await this.nextNumber({
            classId: admission.classId ?? dto.classId,
            date: admission.date ?? dto.admissionDate,
          });
      if (dto.rfidCardNo) await this.assertRfidFree(dto.rfidCardNo);

      const student = await this.studentRepo.saveNew({
        admissionNumber,
        firstName: dto.firstName,
        middleName: dto.middleName ?? null,
        lastName: dto.lastName,
        nameBn: dto.nameBn ?? null,
        dob: dto.dob ?? null,
        gender: dto.gender ?? null,
        religion: dto.religion ?? null,
        nationality: dto.nationality ?? null,
        birthRegNo: dto.birthRegNo ?? null,
        bloodGroup: dto.bloodGroup ?? null,
        previousSchool: dto.previousSchool ?? null,
        email: dto.email ?? null,
        phone: dto.phone ? normalizePhone(dto.phone) : null,
        address: dto.address ?? null,
        admissionDate: dto.admissionDate ?? null,
        admissionType: dto.admissionType ?? null,
        rfidCardNo: dto.rfidCardNo ?? null,
        status: StudentStatus.ACTIVE,
        userId: null,
      });
      return this.findById(student.id);
    });
  }

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.findById(id);

    if (
      dto.admissionNumber &&
      dto.admissionNumber !== student.admissionNumber
    ) {
      await this.manualNumber(dto.admissionNumber, id);
    }
    if (dto.rfidCardNo && dto.rfidCardNo !== student.rfidCardNo) {
      await this.assertRfidFree(dto.rfidCardNo, id);
    }

    await this.studentRepo.updateFields(id, {
      ...dto,
      ...(dto.phone !== undefined && {
        phone: dto.phone ? normalizePhone(dto.phone) : null,
      }),
    });
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.studentRepo.deleteById(id);
  }

  // --- Status lifecycle --------------------------------------------------

  /**
   * Moves the student to another status if {@link STATUS_TRANSITIONS}
   * allows it, and records it in `student_status_history`. Callers close
   * or reopen the enrollment (EnrollmentService). Joins the caller's
   * transaction.
   */
  changeStatus(id: string, dto: ChangeStudentStatusDto): Promise<StatusChange> {
    return this.ds.runInTransaction(async () => {
      const student = await this.findById(id);
      const from = student.status;
      const to = dto.status;
      if (from === to || !STATUS_TRANSITIONS[from]?.includes(to)) {
        throw new BadRequestException({
          message: `A ${from} student can't become ${to}`,
          code: 'INVALID_STATUS_TRANSITION',
        });
      }
      if (to === StudentStatus.ACTIVE) {
        // Re-admission counts against the plan again.
        await this.entitlements.assertLimit(this.ds.orgId, 'students');
      }
      const effectiveDate = dto.effectiveDate ?? (await this.settings.today());
      await this.studentRepo.updateFields(id, { status: to });
      await this.historyRepo.saveNew({
        studentId: id,
        fromStatus: from,
        toStatus: to,
        reason: dto.reason ?? null,
        effectiveDate,
        changedBy: this.context.current().userId,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.STUDENT_STATUS_CHANGED,
        entityType: 'student',
        entityId: id,
        before: { status: from },
        after: { status: to, effectiveDate, reason: dto.reason ?? null },
      });
      return { student: await this.findById(id), from, to, effectiveDate };
    });
  }

  /**
   * Puts a status back without the transition rules (promotion rollback
   * undoing a graduation), with a history row saying so.
   */
  async restoreStatus(
    id: string,
    to: StudentStatus,
    reason: string,
  ): Promise<void> {
    const student = await this.findById(id);
    if (student.status === to) return;
    await this.studentRepo.updateFields(id, { status: to });
    await this.historyRepo.saveNew({
      studentId: id,
      fromStatus: student.status,
      toStatus: to,
      reason,
      effectiveDate: await this.settings.today(),
      changedBy: this.context.current().userId,
    });
  }

  async statusHistory(id: string): Promise<StudentStatusHistory[]> {
    await this.findById(id);
    return this.historyRepo.findByStudent(id);
  }

  // --- Photo -------------------------------------------------------------

  async setPhoto(
    id: string,
    file: IncomingFile,
  ): Promise<{ fileId: string; url: string }> {
    const student = await this.findById(id);
    const stored = await this.files.upload(file, 'student_photo');
    try {
      await this.studentRepo.updateFields(id, { photoFileId: stored.id });
    } catch (err) {
      await this.removeFileQuietly(stored.id);
      throw err;
    }
    if (student.photoFileId) await this.removeFileQuietly(student.photoFileId);
    return {
      fileId: stored.id,
      url: await this.files.getDownloadUrl(stored.id),
    };
  }

  photoUrl(student: Pick<Student, 'photoFileId'>): Promise<string | null> {
    return student.photoFileId
      ? this.files.getDownloadUrl(student.photoFileId)
      : Promise.resolve(null);
  }

  // --- Portal account ----------------------------------------------------

  /** Whether a class gets student portal logins (`settings.portal`). */
  async classQualifies(cls: Pick<Class, 'id' | 'level'>): Promise<boolean> {
    const portal = await this.settings.getSection('portal');
    if (!portal.studentAccounts) return false;
    if (portal.studentClassIds.length) {
      return portal.studentClassIds.includes(cls.id);
    }
    return cls.level !== null && cls.level >= portal.studentMinLevel;
  }

  /**
   * Gives the student a portal login when their class qualifies and they
   * have their own email or phone (PRD 6.6). Skipped when that identifier
   * already belongs to a member here (often a guardian's phone): the
   * student shares no one's account. Returns the provisioning (its mail
   * goes out after the caller commits), or null when nothing was made.
   */
  async ensurePortalAccount(
    studentId: string,
    cls: Pick<Class, 'id' | 'level'>,
  ): Promise<ProvisionResult | null> {
    const student = await this.findById(studentId);
    if (student.userId || student.status !== StudentStatus.ACTIVE) return null;
    if (!student.email && !student.phone) return null;
    if (!(await this.classQualifies(cls))) return null;
    try {
      const result = await this.invites.provision({
        name: student.fullName,
        email: student.email ?? undefined,
        phone: student.email ? undefined : (student.phone ?? undefined),
        portalRole: STUDENT_ROLE_NAME,
        membership: 'active',
        phoneSlip: false,
      });
      await this.studentRepo.updateFields(studentId, { userId: result.userId });
      return result;
    } catch (err) {
      if (
        err instanceof ConflictException &&
        (err.getResponse() as { code?: string }).code === 'ALREADY_MEMBER'
      ) {
        this.logger.log(
          `Student ${studentId}: contact belongs to a member, no portal login`,
        );
        return null;
      }
      throw err;
    }
  }

  /** A printed-slip password for the student's portal login. */
  async portalSlip(studentId: string): Promise<{ temporaryPassword: string }> {
    const student = await this.findById(studentId);
    if (!student.userId) {
      throw new NotFoundException({
        message: 'The student has no portal login',
        code: 'NO_PORTAL_ACCOUNT',
      });
    }
    return this.invites.issueSlip(student.userId);
  }

  // --- Helpers -----------------------------------------------------------

  private async criteria(
    filter: FilterStudentDto,
    allowedSectionIds: string[] | null,
  ): Promise<StudentSearch> {
    let placement: StudentSearch['placement'];
    if (filter.classId || filter.sectionId || filter.academicYearId) {
      const academicYearId =
        filter.academicYearId ?? (await this.currentYearId());
      placement = {
        academicYearId,
        classId: filter.classId,
        sectionId: filter.sectionId,
      };
    }
    return {
      q: filter.q,
      id: filter.id,
      admissionNumber: filter.admissionNumber,
      status: filter.status,
      gender: filter.gender,
      religion: filter.religion,
      placement,
      allowedSectionIds,
    };
  }

  /** The current session's id; class filters without one match nothing. */
  private async currentYearId(): Promise<string> {
    const year = await this.academicYears.findCurrent();
    return year?.id ?? NO_SESSION;
  }

  /** A typed-in ID: only where allowed, and not taken. */
  private async manualNumber(
    admissionNumber: string,
    exceptId?: string,
  ): Promise<string> {
    const numbering = await this.settings.getSection('numbering');
    if (!numbering.allowManualStudentId) {
      throw new BadRequestException({
        message:
          'Student IDs are generated; this school does not allow typing one',
        code: 'MANUAL_ID_NOT_ALLOWED',
      });
    }
    const existing =
      await this.studentRepo.findByAdmissionNumber(admissionNumber);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({
        message: 'Student ID already in use',
        code: 'STUDENT_ID_TAKEN',
      });
    }
    return admissionNumber;
  }

  /**
   * The next ID from `numbering.studentId`, counted per rendered prefix
   * (e.g. year + class), skipping IDs typed in by hand. Call inside the
   * insert's transaction: the counter row stays locked until it ends, so
   * concurrent admissions never get the same ID.
   */
  private async nextNumber(ctx: AdmissionContext): Promise<string> {
    const pattern = (await this.settings.getSection('numbering')).studentId;
    let code: string | undefined;
    if (usesClassCode(pattern)) {
      if (!ctx.classId) {
        throw new BadRequestException({
          message:
            "The student ID pattern uses the class: give the student's class",
          code: 'CLASS_REQUIRED',
        });
      }
      const cls = await this.classService.findById(ctx.classId);
      code = classCode(cls) ?? undefined;
      if (!code) {
        throw new BadRequestException({
          message: 'Give the class a code or level for student IDs',
          code: 'CLASS_CODE_REQUIRED',
        });
      }
    }
    const day = ctx.date ?? (await this.settings.today());
    const numberingCtx = {
      date: new Date(`${day}T12:00:00`),
      classCode: code,
    };
    const scope = patternScope(pattern, numberingCtx);
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const candidate = await this.numbering.nextFormatted(
        STUDENT_ID_KEY,
        pattern,
        scope,
        numberingCtx,
      );
      if (!(await this.studentRepo.findByAdmissionNumber(candidate))) {
        return candidate;
      }
    }
    throw new ConflictException({
      message: 'Could not generate a free student ID; enter one',
      code: 'STUDENT_ID_EXHAUSTED',
    });
  }

  private async assertRfidFree(rfidCardNo: string, exceptId?: string) {
    const existing = await this.studentRepo.findByRfid(rfidCardNo);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({
        message: 'This RFID card is bound to another student',
        code: 'RFID_TAKEN',
      });
    }
  }

  private async removeFileQuietly(fileId: string): Promise<void> {
    await this.files
      .remove(fileId)
      .catch((err: Error) =>
        this.logger.warn(`Could not remove file ${fileId}: ${err.message}`),
      );
  }
}
