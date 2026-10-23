import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { QUEUES } from '~/shared/queue';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import type { AcademicYear } from '~/modules/academic-years/entities/academic-year.entity';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { ClassSubjectGroupService } from '~/modules/class-curriculum/services/class-subject-group.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { JobService } from '~/modules/jobs/services/job.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { SectionService } from '~/modules/sections/section.service';
import {
  TeachingService,
  type TeacherCopyResult,
} from '~/modules/teaching/services/teaching.service';
import { RolloverDto, RolloverInput } from './dto/rollover.dto';

export const ROLLOVER_JOB = 'session-rollover';

type Counts = { created: number; skipped: number };

export interface RolloverResult {
  fromYearId: string;
  targetId: string;
  mode: 'refuse' | 'merge';
  sections?: Counts;
  classSubjects?: Counts;
  subjectGroups?: Counts;
  teachers?: TeacherCopyResult;
}

/**
 * Session rollover (PRD 6.4): copies a session's sections, curriculum
 * (class subjects with components, groups offered) and current teacher
 * assignments into another session, with new ids, in one transaction.
 * Never touches enrollments: moving students is promotion (6.6).
 */
@Injectable()
export class RolloverService {
  constructor(
    private readonly academicYears: AcademicYearService,
    private readonly sections: SectionService,
    private readonly classSubjects: ClassSubjectService,
    private readonly classSubjectGroups: ClassSubjectGroupService,
    private readonly teaching: TeachingService,
    private readonly jobs: JobService,
    private readonly audit: AuditService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /**
   * Checks the request now (so mistakes come back as 4xx, not a failed
   * job) and queues the copy; poll `GET /jobs/:id`.
   */
  async start(targetId: string, dto: RolloverDto): Promise<Job> {
    await this.check({ targetId, ...dto });
    return this.jobs.start<RolloverInput>({
      type: 'academic_years.rollover',
      queue: QUEUES.academic,
      name: ROLLOVER_JOB,
      data: { targetId, ...dto },
      // A refused or merged rerun gives the same answer; no point retrying.
      options: { attempts: 1 },
    });
  }

  /** The job's work, checked again inside its transaction. */
  run(input: RolloverInput): Promise<RolloverResult> {
    return this.ds.runInTransaction(async () => {
      const { target } = await this.check(input);
      const merge = input.mode === 'merge';
      const { fromYearId, targetId, include } = input;
      const result: RolloverResult = {
        fromYearId,
        targetId,
        mode: merge ? 'merge' : 'refuse',
      };

      let sectionIds: Map<string, string> | undefined;
      if (include.sections) {
        const copied = await this.sections.copyToYear(
          fromYearId,
          targetId,
          merge,
        );
        sectionIds = copied.ids;
        result.sections = { created: copied.created, skipped: copied.skipped };
      }

      let classSubjectIds: Map<string, string> | undefined;
      if (include.curriculum) {
        const copied = await this.classSubjects.copyToYear(
          fromYearId,
          targetId,
          merge,
        );
        classSubjectIds = copied.ids;
        result.classSubjects = {
          created: copied.created,
          skipped: copied.skipped,
        };
        result.subjectGroups = await this.classSubjectGroups.copyToYear(
          fromYearId,
          targetId,
          merge,
        );
      }

      if (include.teachers) {
        result.teachers = await this.teaching.copyToYear({
          fromYearId,
          sectionIds:
            sectionIds ??
            (await this.sections.matchInYear(fromYearId, targetId)),
          classSubjectIds:
            classSubjectIds ??
            (await this.classSubjects.matchInYear(fromYearId, targetId)),
          effectiveFrom: target.startDate!,
        });
      }

      await this.audit.record({
        action: AUDIT_ACTIONS.SESSION_ROLLED_OVER,
        entityType: 'academic_year',
        entityId: targetId,
        after: { ...result },
      });
      return result;
    });
  }

  private async check(
    input: RolloverInput,
  ): Promise<{ from: AcademicYear; target: AcademicYear }> {
    const { include } = input;
    if (!include.sections && !include.curriculum && !include.teachers) {
      throw new BadRequestException({
        message: 'Choose at least one of sections, curriculum or teachers',
        code: 'ROLLOVER_NOTHING_TO_COPY',
      });
    }
    if (input.fromYearId === input.targetId) {
      throw new BadRequestException({
        message: 'Pick a different session to copy from',
        code: 'ROLLOVER_SAME_SESSION',
      });
    }
    const from = await this.academicYears.findById(input.fromYearId);
    const target = await this.academicYears.findById(input.targetId);
    if (include.teachers && !target.startDate) {
      throw new BadRequestException({
        message: 'The target session needs dates before teachers can move',
        code: 'INVALID_DATE_RANGE',
      });
    }

    if (input.mode !== 'merge') {
      const taken: string[] = [];
      if (include.sections && (await this.sections.countInYear(target.id))) {
        taken.push('sections');
      }
      if (
        include.curriculum &&
        (await this.classSubjects.countInYear(target.id))
      ) {
        taken.push('curriculum');
      }
      if (include.teachers && (await this.teaching.countInYear(target.id))) {
        taken.push('teachers');
      }
      if (taken.length) {
        throw new ConflictException({
          message: `The target session already has ${taken.join(', ')}; use mode "merge" to add only what is missing`,
          code: 'ROLLOVER_TARGET_NOT_EMPTY',
          taken,
        });
      }
    }
    return { from, target };
  }
}
