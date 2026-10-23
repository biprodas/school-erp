import { Injectable } from '@nestjs/common';
import { QUEUES } from '~/shared/queue';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import type { ExportFormat } from '../dto/export-students.dto';
import type { ExportStudentsDto } from '../dto/export-students.dto';
import type { FilterStudentDto } from '../dto/filter-student.dto';
import { StudentScope } from './student-scope.service';

export const STUDENT_EXPORT_JOB = 'students';

export interface StudentExportInput {
  filter: FilterStudentDto;
  /** The requester's scope, fixed when the export was asked for. */
  allowedSectionIds: string[] | null;
  format: ExportFormat;
}

/** Student list export (PRD 6.6) as a job; audited (PRD 8.1). */
@Injectable()
export class StudentExportService {
  constructor(
    private readonly scope: StudentScope,
    private readonly jobs: JobService,
    private readonly audit: AuditService,
  ) {}

  async start(dto: ExportStudentsDto): Promise<Job> {
    const { format = 'xlsx', page: _page, limit: _limit, ...filter } = dto;
    void [_page, _limit];
    const allowedSectionIds = await this.scope.sections(
      PERMISSIONS.STUDENTS_READ,
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.DATA_EXPORTED,
      entityType: 'students',
      entityId: null,
      after: { format, filter },
    });
    return this.jobs.start<StudentExportInput>({
      type: 'students.export',
      queue: QUEUES.exports,
      name: STUDENT_EXPORT_JOB,
      data: { filter, allowedSectionIds, format },
    });
  }
}
