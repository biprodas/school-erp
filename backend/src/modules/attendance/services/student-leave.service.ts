import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { DEFAULT_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { StudentEnrollmentStatus } from '~/modules/enrollments/enums/student-enrollment-status.enum';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import {
  CreateStudentLeaveDto,
  DecideStudentLeaveDto,
  FilterStudentLeaveDto,
} from '../dto/student-leave.dto';
import { StudentLeaveRequest } from '../entities/student-leave-request.entity';
import { StudentLeaveStatus } from '../enums/attendance.enum';
import { StudentLeaveRepository } from '../repositories/student-leave.repository';
import { AttendanceService } from './attendance.service';

/**
 * Student leave (PRD 6.7): guardians apply (portal, M7) or staff enter a
 * request for them; the class teacher approves or rejects it. Approval
 * puts Leave in the registers already taken for those days, and the days
 * still to come show Leave by default.
 */
@Injectable()
export class StudentLeaveService {
  constructor(
    private readonly leaveRepo: StudentLeaveRepository,
    private readonly enrollments: EnrollmentService,
    private readonly attendance: AttendanceService,
    private readonly files: FileService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** `allowed`: the caller's sections (null = every one). */
  findFiltered(
    filter: FilterStudentLeaveDto,
    allowed: string[] | null,
  ): Promise<Paginated<StudentLeaveRequest>> {
    const where: FindOptionsWhere<StudentLeaveRequest> = {};
    if (filter.status) where.status = filter.status;
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.from) where.toDate = MoreThanOrEqual(filter.from);
    if (filter.to) where.fromDate = LessThanOrEqual(filter.to);
    let sections = filter.sectionId ? [filter.sectionId] : null;
    if (allowed !== null) {
      sections = sections
        ? sections.filter((s) => allowed.includes(s))
        : allowed;
    }
    if (sections) {
      if (!sections.length) {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = filter;
        return Promise.resolve(new Paginated([], 0, { page, limit }));
      }
      where.enrollment = { sectionId: In(sections) };
    }
    return this.leaveRepo.findFiltered(where, filter);
  }

  /** 404 when missing or outside `allowed`. */
  async findById(
    id: string,
    allowed: string[] | null = null,
  ): Promise<StudentLeaveRequest> {
    const leave = await this.leaveRepo.findByIdWithRelations(id);
    if (
      !leave ||
      (allowed !== null && !allowed.includes(leave.enrollment!.sectionId))
    ) {
      throw new NotFoundException(`Leave request "${id}" not found`);
    }
    return leave;
  }

  /**
   * A new pending request. Staff call it for a guardian; the portal (M7)
   * calls it with the guardian as `appliedBy`.
   */
  async create(
    dto: CreateStudentLeaveDto,
    allowed: string[] | null = null,
  ): Promise<StudentLeaveRequest> {
    const enrollment = await this.enrollments.findById(dto.enrollmentId);
    if (allowed !== null && !allowed.includes(enrollment.sectionId)) {
      throw new NotFoundException('Enrollment not found');
    }
    if (enrollment.status !== StudentEnrollmentStatus.ACTIVE) {
      throw new ConflictException({
        message: `A ${enrollment.status} enrollment can't take leave`,
        code: 'ENROLLMENT_NOT_ACTIVE',
      });
    }
    const fromDate = dto.fromDate;
    const toDate = dto.toDate ?? dto.fromDate;
    if (toDate < fromDate) {
      throw new BadRequestException({
        message: 'Leave must end on or after the day it starts',
        code: 'INVALID_DATE_RANGE',
      });
    }
    const year = enrollment.academicYear;
    if (
      (year?.startDate && fromDate < year.startDate) ||
      (year?.endDate && toDate > year.endDate)
    ) {
      throw new BadRequestException({
        message: 'Leave must fall inside the session',
        code: 'DATE_OUTSIDE_SESSION',
      });
    }
    if (
      (await this.leaveRepo.findOverlapping(enrollment.id, fromDate, toDate))
        .length
    ) {
      throw new ConflictException({
        message: 'Another leave request covers some of these days',
        code: 'LEAVE_OVERLAPS',
      });
    }
    const saved = await this.leaveRepo.saveNew({
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      fromDate,
      toDate,
      reason: dto.reason,
      attachmentFileId: null,
      status: StudentLeaveStatus.PENDING,
      appliedByUserId: this.context.current().userId,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    });
    return this.findById(saved.id);
  }

  /** Attaches (or replaces) a supporting file, e.g. a doctor's note. */
  async attach(
    id: string,
    file: IncomingFile,
    allowed: string[] | null,
  ): Promise<StudentLeaveRequest> {
    const leave = await this.findById(id, allowed);
    const stored = await this.files.upload(file, 'attachment');
    await this.leaveRepo.updateFields(id, { attachmentFileId: stored.id });
    if (leave.attachmentFileId) {
      await this.files.remove(leave.attachmentFileId).catch(() => undefined);
    }
    return this.findById(id);
  }

  async attachmentUrl(
    id: string,
    allowed: string[] | null,
  ): Promise<{ url: string }> {
    const leave = await this.findById(id, allowed);
    if (!leave.attachmentFileId) {
      throw new NotFoundException({
        message: 'This request has no attachment',
        code: 'NO_ATTACHMENT',
      });
    }
    return { url: await this.files.getDownloadUrl(leave.attachmentFileId) };
  }

  /** Approves a pending request and marks taken registers as Leave. */
  approve(
    id: string,
    dto: DecideStudentLeaveDto,
    allowed: string[] | null,
  ): Promise<StudentLeaveRequest & { registersUpdated: number }> {
    return this.ds.runInTransaction(async () => {
      const leave = await this.decide(
        id,
        StudentLeaveStatus.APPROVED,
        dto,
        allowed,
      );
      const registersUpdated = await this.attendance.applyApprovedLeave({
        leaveId: leave.id,
        enrollmentId: leave.enrollmentId,
        sectionId: leave.enrollment!.sectionId,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
      });
      return Object.assign(await this.findById(id), { registersUpdated });
    });
  }

  reject(
    id: string,
    dto: DecideStudentLeaveDto,
    allowed: string[] | null,
  ): Promise<StudentLeaveRequest> {
    return this.ds.runInTransaction(async () => {
      await this.decide(id, StudentLeaveStatus.REJECTED, dto, allowed);
      return this.findById(id);
    });
  }

  /** Withdraws a pending request. */
  async cancel(
    id: string,
    allowed: string[] | null,
  ): Promise<StudentLeaveRequest> {
    const leave = await this.findById(id, allowed);
    assertPending(leave);
    await this.leaveRepo.updateFields(id, {
      status: StudentLeaveStatus.CANCELLED,
    });
    return this.findById(id);
  }

  private async decide(
    id: string,
    status: StudentLeaveStatus.APPROVED | StudentLeaveStatus.REJECTED,
    dto: DecideStudentLeaveDto,
    allowed: string[] | null,
  ): Promise<StudentLeaveRequest> {
    const leave = await this.findById(id, allowed);
    assertPending(leave);
    if (
      status === StudentLeaveStatus.APPROVED &&
      (
        await this.leaveRepo.findOverlapping(
          leave.enrollmentId,
          leave.fromDate,
          leave.toDate,
          leave.id,
        )
      ).some((l) => l.status === StudentLeaveStatus.APPROVED)
    ) {
      throw new ConflictException({
        message: 'Another approved leave covers some of these days',
        code: 'LEAVE_OVERLAPS',
      });
    }
    await this.leaveRepo.updateFields(id, {
      status,
      decidedBy: this.context.current().userId,
      decidedAt: new Date(),
      decisionNote: dto.note ?? null,
    });
    await this.audit.record({
      action:
        status === StudentLeaveStatus.APPROVED
          ? AUDIT_ACTIONS.STUDENT_LEAVE_APPROVED
          : AUDIT_ACTIONS.STUDENT_LEAVE_REJECTED,
      entityType: 'student_leave',
      entityId: id,
      before: { status: leave.status },
      after: { status, note: dto.note ?? null },
    });
    return leave;
  }
}

function assertPending(leave: StudentLeaveRequest): void {
  if (leave.status !== StudentLeaveStatus.PENDING) {
    throw new ConflictException({
      message: `The request is ${leave.status}, not pending`,
      code: 'LEAVE_NOT_PENDING',
    });
  }
}
