import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { In, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { StudentService } from '~/modules/students/services/student.service';
import {
  DecisionDto,
  FilterStudentDiscountDto,
  RequestStudentDiscountDto,
} from '../dto/fee-setup.dto';
import type { StudentDiscount } from '../entities/discount.entity';
import { ApprovalStatus } from '../enums/fee.enum';
import { StudentDiscountRepository } from '../repositories/fee.repositories';
import { FeeSetupService } from './fee-setup.service';

/**
 * Discounts given to students (PRD 6.10 "waivers go through an approval
 * workflow"): requested, then approved or rejected with
 * `fees:approve_waiver`. Approved discounts apply to invoices generated
 * from then on; bills already made change through adjustments.
 */
@Injectable()
export class StudentDiscountService {
  constructor(
    private readonly discountRepo: StudentDiscountRepository,
    private readonly setup: FeeSetupService,
    private readonly students: StudentService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  list(filter: FilterStudentDiscountDto): Promise<StudentDiscount[]> {
    return this.discountRepo.find({
      where: { studentId: filter.studentId, status: filter.status },
      relations: { discountType: true, student: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Approved discounts of some students that cover `period`. */
  approvedFor(
    studentIds: string[],
    period: string,
  ): Promise<StudentDiscount[]> {
    if (!studentIds.length) return Promise.resolve([]);
    const base = {
      studentId: In(studentIds),
      status: ApprovalStatus.APPROVED,
      fromPeriod: LessThanOrEqual(period),
    };
    return this.discountRepo.find({
      where: [
        { ...base, toPeriod: IsNull() },
        { ...base, toPeriod: MoreThanOrEqual(period) },
      ],
      relations: { discountType: true },
    });
  }

  async request(dto: RequestStudentDiscountDto): Promise<StudentDiscount> {
    await this.students.findById(dto.studentId);
    const type = await this.setup.findDiscountType(dto.discountTypeId);
    if (!type.isActive) {
      throw new ConflictException({
        message: 'This discount type is inactive',
        code: 'DISCOUNT_TYPE_INACTIVE',
      });
    }
    if (dto.toPeriod && dto.toPeriod < dto.fromPeriod) {
      throw new BadRequestException({
        message: 'The discount must end on or after it starts',
        code: 'INVALID_PERIOD_RANGE',
      });
    }
    return this.discountRepo.saveNew({
      studentId: dto.studentId,
      discountTypeId: dto.discountTypeId,
      valueOverride: dto.valueOverride ?? null,
      fromPeriod: dto.fromPeriod,
      toPeriod: dto.toPeriod ?? null,
      reason: dto.reason ?? null,
      status: ApprovalStatus.PENDING,
      requestedBy: this.context.current().userId,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    });
  }

  approve(id: string, dto: DecisionDto) {
    return this.decide(id, ApprovalStatus.APPROVED, dto);
  }

  reject(id: string, dto: DecisionDto) {
    return this.decide(id, ApprovalStatus.REJECTED, dto);
  }

  private decide(id: string, status: ApprovalStatus, dto: DecisionDto) {
    return this.ds.runInTransaction(async () => {
      const discount = await this.discountRepo.findByIdOrFail(id);
      if (discount.status !== ApprovalStatus.PENDING) {
        throw new ConflictException({
          message: `The discount is ${discount.status}`,
          code: 'NOT_PENDING',
        });
      }
      await this.discountRepo.updateById(id, {
        status,
        decidedBy: this.context.current().userId,
        decidedAt: new Date(),
        decisionNote: dto.note ?? null,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.FEE_DISCOUNT_DECIDED,
        entityType: 'student_discount',
        entityId: id,
        before: { status: discount.status },
        after: { status, note: dto.note ?? null },
      });
      return this.discountRepo.findByIdOrFail(id);
    });
  }
}
