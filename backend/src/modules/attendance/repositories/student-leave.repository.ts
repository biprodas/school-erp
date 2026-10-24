import { Inject, Injectable } from '@nestjs/common';
import {
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { PaginationQueryDto } from '~/common/dto/pagination-query.dto';
import { Paginated } from '~/common/dto/paginated.dto';
import { StudentLeaveRequest } from '../entities/student-leave-request.entity';
import { StudentLeaveStatus } from '../enums/attendance.enum';

const OPEN = [StudentLeaveStatus.PENDING, StudentLeaveStatus.APPROVED];

@Injectable()
export class StudentLeaveRepository extends BaseTenantRepository<StudentLeaveRequest> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentLeaveRequest, 'StudentLeaveRequest');
  }

  findByIdWithRelations(id: string): Promise<StudentLeaveRequest | null> {
    return this.repo.findOne({
      where: { id },
      relations: { student: true, enrollment: { section: true } },
    });
  }

  /** Pending or approved requests of an enrollment overlapping a range. */
  findOverlapping(
    enrollmentId: string,
    from: string,
    to: string,
    exceptId?: string,
  ): Promise<StudentLeaveRequest[]> {
    return this.repo.find({
      where: {
        enrollmentId,
        status: In(OPEN),
        fromDate: LessThanOrEqual(to),
        toDate: MoreThanOrEqual(from),
        ...(exceptId && { id: Not(exceptId) }),
      },
    });
  }

  /** Enrollments (of the given ones) on approved leave on `date`. */
  async onLeave(enrollmentIds: string[], date: string): Promise<Set<string>> {
    if (!enrollmentIds.length) return new Set();
    const rows = await this.repo.find({
      where: {
        enrollmentId: In(enrollmentIds),
        status: StudentLeaveStatus.APPROVED,
        fromDate: LessThanOrEqual(date),
        toDate: MoreThanOrEqual(date),
      },
      select: { id: true, enrollmentId: true },
    });
    return new Set(rows.map((r) => r.enrollmentId));
  }

  async updateFields(
    id: string,
    patch: Partial<
      Pick<
        StudentLeaveRequest,
        | 'status'
        | 'decidedBy'
        | 'decidedAt'
        | 'decisionNote'
        | 'attachmentFileId'
      >
    >,
  ): Promise<void> {
    await this.repo.update({ id }, patch);
  }

  findFiltered(
    where: FindOptionsWhere<StudentLeaveRequest>,
    page: PaginationQueryDto,
  ): Promise<Paginated<StudentLeaveRequest>> {
    return this.findPage(
      {
        where,
        relations: {
          student: true,
          enrollment: { section: { schoolClass: true } },
        },
        order: { fromDate: 'DESC', createdAt: 'DESC' },
      },
      page,
    );
  }
}
