import { ForbiddenException, Injectable } from '@nestjs/common';
import { QUEUES } from '~/shared/queue';
import type { SheetColumn } from '~/shared/spreadsheet/spreadsheet';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { AttendanceReportService } from '~/modules/attendance/services/attendance-report.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { FeeReportService } from '~/modules/fees/services/fee-report.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import {
  PERMISSIONS,
  type PermissionKey,
} from '~/modules/rbac/permissions.catalog';
import type { ReportExportDto, ReportKey } from '../dto/report-export.dto';

export const REPORT_EXPORT_JOB = 'report-export';

export interface ReportExportData {
  report: ReportKey;
  params: Record<string, string | number>;
  /** The requester's sections when asked (null = every one). */
  allowed: string[] | null;
}

type Row = Record<string, string | number | null>;

const PERMISSION: Record<ReportKey, PermissionKey> = {
  'fees.dues': PERMISSIONS.FEES_READ,
  'fees.defaulters': PERMISSIONS.FEES_READ,
  'attendance.defaulters': PERMISSIONS.ATTENDANCE_READ,
  'attendance.late-comers': PERMISSIONS.ATTENDANCE_READ,
};

const money = (minor: number) => minor / 100;
const str = (v: string | number | undefined) =>
  v === undefined || v === null ? undefined : String(v);
const num = (v: string | number | undefined) =>
  v === undefined || v === null ? undefined : Number(v);

/**
 * Large report exports (PRD 6.22 "exports run in the background"): the
 * same rows as the report endpoints, written to Excel by a job, with the
 * requester's scope fixed when asked. Audited as `data.exported`.
 */
@Injectable()
export class ReportExportService {
  constructor(
    private readonly scope: AccessScope,
    private readonly jobs: JobService,
    private readonly audit: AuditService,
    private readonly feeReports: FeeReportService,
    private readonly attendance: AttendanceReportService,
  ) {}

  async start(dto: ReportExportDto): Promise<Job> {
    const key = PERMISSION[dto.report];
    if (!(await this.scope.can(key))) {
      throw new ForbiddenException({
        message: `This report needs ${key}`,
        code: 'FORBIDDEN',
      });
    }
    const allowed = await this.scope.sections(key);
    const params = dto.params ?? {};
    await this.audit.record({
      action: AUDIT_ACTIONS.DATA_EXPORTED,
      entityType: 'report',
      entityId: null,
      after: { report: dto.report, params },
    });
    return this.jobs.start<ReportExportData>({
      type: `reports.${dto.report}`,
      queue: QUEUES.exports,
      name: REPORT_EXPORT_JOB,
      data: { report: dto.report, params, allowed },
    });
  }

  /** The report's columns and rows (the job writes them). */
  async table(
    data: ReportExportData,
  ): Promise<{ columns: SheetColumn<Row>[]; rows: Row[] }> {
    const p = data.params;
    switch (data.report) {
      case 'fees.dues':
      case 'fees.defaulters': {
        const result =
          data.report === 'fees.dues'
            ? await this.feeReports.dues(
                {
                  classId: str(p.classId),
                  sectionId: str(p.sectionId),
                  asOf: str(p.asOf),
                },
                data.allowed,
              )
            : await this.feeReports.defaulters(
                {
                  classId: str(p.classId),
                  sectionId: str(p.sectionId),
                  asOf: str(p.asOf),
                  minDays: num(p.minDays),
                  minAmount: num(p.minAmount),
                },
                data.allowed,
              );
        return {
          columns: [
            { key: 'admissionNumber', header: 'Student ID' },
            { key: 'name', header: 'Name', width: 28 },
            { key: 'className', header: 'Class' },
            { key: 'sectionName', header: 'Section' },
            { key: 'rollNo', header: 'Roll' },
            { key: 'outstanding', header: 'Outstanding' },
            { key: 'overdue', header: 'Overdue' },
            { key: 'b0', header: '0–30 days' },
            { key: 'b31', header: '31–60 days' },
            { key: 'b61', header: '61–90 days' },
            { key: 'b90', header: '90+ days' },
            { key: 'oldestDueDate', header: 'Oldest due' },
          ],
          rows: result.students.map((s) => ({
            admissionNumber: s.admissionNumber,
            name: s.name,
            className: s.className,
            sectionName: s.sectionName,
            rollNo: s.rollNo,
            outstanding: money(s.outstanding),
            overdue: money(s.overdue),
            b0: money(s.buckets['0-30']),
            b31: money(s.buckets['31-60']),
            b61: money(s.buckets['61-90']),
            b90: money(s.buckets['90+']),
            oldestDueDate: s.oldestDueDate,
          })),
        };
      }
      default: {
        const query = {
          academicYearId: str(p.academicYearId),
          from: str(p.from),
          to: str(p.to),
          classId: str(p.classId),
          sectionId: str(p.sectionId),
        };
        const result =
          data.report === 'attendance.defaulters'
            ? await this.attendance.defaulters(
                { ...query, threshold: num(p.threshold) },
                data.allowed,
              )
            : await this.attendance.lateComers(
                { ...query, minLate: num(p.minLate) },
                data.allowed,
              );
        return {
          columns: [
            { key: 'admissionNumber', header: 'Student ID' },
            { key: 'name', header: 'Name', width: 28 },
            { key: 'className', header: 'Class' },
            { key: 'sectionName', header: 'Section' },
            { key: 'rollNo', header: 'Roll' },
            { key: 'days', header: 'Days' },
            { key: 'present', header: 'Present' },
            { key: 'absent', header: 'Absent' },
            { key: 'late', header: 'Late' },
            { key: 'leave', header: 'Leave' },
            { key: 'percentage', header: '%' },
          ],
          rows: result.rows.map((r) => ({
            admissionNumber: r.admissionNumber,
            name: r.name,
            className: r.className,
            sectionName: r.sectionName,
            rollNo: r.rollNo,
            days: r.days,
            present: r.present,
            absent: r.absent,
            late: r.late,
            leave: r.leave,
            percentage: r.percentage,
          })),
        };
      }
    }
  }
}
