import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { QUEUES } from '~/shared/queue';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AttendanceUsageService } from '~/modules/attendance/services/attendance-usage.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import type { ProvisionResult } from '~/modules/auth/services/invite.service';
import { ClassService } from '~/modules/classes/class.service';
import type { Class } from '~/modules/classes/entities/class.entity';
import type { StudentEnrollment } from '~/modules/enrollments/entities/student-enrollment.entity';
import { StudentEnrollmentStatus } from '~/modules/enrollments/enums/student-enrollment-status.enum';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import type { Section } from '~/modules/sections/entities/section.entity';
import { SectionService } from '~/modules/sections/section.service';
import { StudentStatus } from '~/modules/students/enums/student-status.enum';
import { StudentService } from '~/modules/students/services/student.service';
import { CreatePromotionBatchDto } from '../dto/create-promotion-batch.dto';
import { FilterPromotionBatchDto } from '../dto/filter-promotion-batch.dto';
import { UpdatePromotionItemDto } from '../dto/update-promotion-item.dto';
import {
  PromotionBatch,
  type PromotionOptions,
} from '../entities/promotion-batch.entity';
import { PromotionBatchItem } from '../entities/promotion-batch-item.entity';
import {
  PromotionBatchStatus,
  PromotionOutcome,
  ROLLBACK_WINDOW_MS,
  RollBy,
} from '../enums/promotion.enum';
import { PromotionBatchItemRepository } from '../repositories/promotion-batch-item.repository';
import { PromotionBatchRepository } from '../repositories/promotion-batch.repository';

export const PROMOTION_COMMIT_JOB = 'promotion-commit';

export interface PromotionPreview extends PromotionBatch {
  items: PromotionBatchItem[];
  summary: Record<PromotionOutcome, number>;
}

/** Numeric rolls sort as numbers, others after them as text. */
const byRoll = (a: string | null, b: string | null) => {
  const na = Number(a);
  const nb = Number(b);
  if (a && b && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return (a ?? '￿').localeCompare(b ?? '￿');
};

/**
 * Bulk promotion of a class into the next session (PRD 6.6), replacing the
 * old one-row promotion log:
 *
 * 1. `create` builds a draft: every active enrollment of the class gets an
 *    outcome (promote; graduate in the final class), a section of the next
 *    class and a new roll.
 * 2. `updateItem` overrides one student (detain, another section, roll).
 * 3. `commit` (a job, one transaction) creates the next session's
 *    enrollments, closes the old ones and graduates the final class.
 * 4. `rollback` undoes a commit within 24 hours, if nothing uses the new
 *    enrollments yet.
 *
 * Outcomes will come from the published combined result once exams (M5)
 * exist; until then everyone is promoted and merit order is the old roll.
 */
@Injectable()
export class PromotionService {
  constructor(
    private readonly batchRepo: PromotionBatchRepository,
    private readonly itemRepo: PromotionBatchItemRepository,
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly sections: SectionService,
    private readonly enrollments: EnrollmentService,
    private readonly students: StudentService,
    private readonly jobs: JobService,
    private readonly attendance: AttendanceUsageService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(
    filter: FilterPromotionBatchDto,
  ): Promise<Paginated<PromotionBatch>> {
    const where: FindOptionsWhere<PromotionBatch> = {};
    if (filter.fromYearId) where.fromYearId = filter.fromYearId;
    if (filter.classId) where.classId = filter.classId;
    if (filter.status) where.status = filter.status;
    return this.batchRepo.findFiltered(where, filter);
  }

  /** The batch with its items and a count per outcome (the preview). */
  async preview(id: string): Promise<PromotionPreview> {
    const batch = await this.batchRepo.findByIdOrFail(id);
    const items = (await this.itemRepo.findByBatch(id)).sort(
      (a, b) =>
        (a.toSection?.name ?? '').localeCompare(b.toSection?.name ?? '') ||
        byRoll(a.newRoll, b.newRoll),
    );
    const summary = Object.fromEntries(
      Object.values(PromotionOutcome).map((o) => [
        o,
        items.filter((i) => i.outcome === o).length,
      ]),
    ) as Record<PromotionOutcome, number>;
    return Object.assign(batch, { items, summary });
  }

  // --- Draft -------------------------------------------------------------

  create(dto: CreatePromotionBatchDto): Promise<PromotionPreview> {
    return this.ds
      .runInTransaction(async () => {
        const from = await this.academicYears.findById(dto.fromYearId);
        const to = await this.academicYears.findById(dto.toYearId);
        if (
          !from.startDate ||
          !to.startDate ||
          to.startDate <= from.startDate
        ) {
          throw new BadRequestException({
            message: 'Promote into a later session',
            code: 'INVALID_TARGET_SESSION',
          });
        }
        const cls = await this.classes.findById(dto.classId);
        if (await this.batchRepo.findLive(dto.fromYearId, dto.classId)) {
          throw new ConflictException({
            message: 'This class already has a promotion batch for the session',
            code: 'PROMOTION_EXISTS',
          });
        }
        const options: PromotionOptions = {
          rollBy: dto.options?.rollBy ?? RollBy.MERIT,
          shuffleSections: dto.options?.shuffleSections ?? false,
        };
        const batch = await this.batchRepo.saveNew({
          fromYearId: dto.fromYearId,
          toYearId: dto.toYearId,
          classId: dto.classId,
          status: PromotionBatchStatus.DRAFT,
          options,
          createdBy: this.context.current().userId,
          committedAt: null,
          committedBy: null,
          rolledBackAt: null,
          rolledBackBy: null,
        });
        await this.buildItems(batch, cls);
        return batch.id;
      })
      .then((id) => this.preview(id));
  }

  /** Discards a draft. */
  async remove(id: string): Promise<void> {
    const batch = await this.batchRepo.findByIdOrFail(id);
    assertStatus(batch, PromotionBatchStatus.DRAFT);
    await this.batchRepo.deleteById(id);
  }

  async updateItem(
    batchId: string,
    itemId: string,
    dto: UpdatePromotionItemDto,
  ): Promise<PromotionBatchItem> {
    const batch = await this.batchRepo.findByIdOrFail(batchId);
    assertStatus(batch, PromotionBatchStatus.DRAFT);
    const item = await this.itemRepo.findById(itemId);
    if (!item || item.batchId !== batchId) {
      throw new NotFoundException('Promotion item not found');
    }

    const outcome = dto.outcome ?? item.outcome;
    let toClassId = item.toClassId;
    let toSectionId = item.toSectionId;
    if (dto.outcome && dto.outcome !== item.outcome) {
      toClassId = await this.targetClassId(batch, outcome);
      toSectionId = null;
    }
    if (outcome === PromotionOutcome.GRADUATE) {
      toClassId = null;
      toSectionId = null;
    } else if (dto.toSectionId) {
      const section = await this.sections.findById(dto.toSectionId);
      if (
        section.academicYearId !== batch.toYearId ||
        section.classId !== toClassId
      ) {
        throw new BadRequestException({
          message: 'Pick a section of the target class in the next session',
          code: 'SECTION_NOT_IN_CLASS',
        });
      }
      toSectionId = section.id;
    } else if (!toSectionId && toClassId) {
      toSectionId =
        (await this.targetSections(batch.toYearId, toClassId))[0]?.id ?? null;
    }

    await this.itemRepo.updateFields(itemId, {
      outcome,
      toClassId,
      toSectionId,
      newRoll:
        outcome === PromotionOutcome.GRADUATE
          ? null
          : dto.newRoll !== undefined
            ? dto.newRoll
            : item.newRoll,
      note: dto.note ?? item.note,
      overridden: true,
    });
    return (await this.itemRepo.findById(itemId))!;
  }

  // --- Commit ------------------------------------------------------------

  /** Checks the draft now, then queues the commit; poll `GET /jobs/:id`. */
  async startCommit(id: string): Promise<Job> {
    await this.checkCommittable(id);
    return this.jobs.start<{ batchId: string }>({
      type: 'promotions.commit',
      queue: QUEUES.academic,
      name: PROMOTION_COMMIT_JOB,
      data: { batchId: id },
      options: { attempts: 1 },
    });
  }

  /** The job's work: one transaction for the whole class. */
  async commit(id: string): Promise<{ promoted: number; graduated: number }> {
    const accounts: ProvisionResult[] = [];
    const result = await this.ds.runInTransaction(async () => {
      const { batch, items } = await this.checkCommittable(id);
      let promoted = 0;
      let graduated = 0;
      for (const item of items) {
        if (item.outcome === PromotionOutcome.GRADUATE) {
          await this.enrollments.setStatus(
            item.enrollmentId!,
            StudentEnrollmentStatus.COMPLETED,
          );
          const before = await this.students.findById(item.studentId);
          await this.students.changeStatus(item.studentId, {
            status: StudentStatus.GRADUATED,
            reason: 'Promotion: final class',
          });
          await this.itemRepo.updateFields(item.id, {
            previousStatus: before.status,
          });
          graduated++;
          continue;
        }
        const made = await this.enrollments.enroll(
          {
            studentId: item.studentId,
            academicYearId: batch.toYearId,
            classId: item.toClassId!,
            sectionId: item.toSectionId!,
            rollNo: item.newRoll ?? undefined,
            // The school decided these placements in the preview.
            overrideCapacity: true,
          },
          { canOverrideCapacity: true },
        );
        if (made.account) accounts.push(made.account);
        await this.enrollments.setStatus(
          item.enrollmentId!,
          item.outcome === PromotionOutcome.DETAIN
            ? StudentEnrollmentStatus.COMPLETED
            : StudentEnrollmentStatus.PROMOTED,
        );
        await this.itemRepo.updateFields(item.id, {
          newEnrollmentId: made.enrollment.id,
        });
        promoted++;
      }
      await this.batchRepo.updateFields(id, {
        status: PromotionBatchStatus.COMMITTED,
        committedAt: new Date(),
        committedBy: this.context.current().userId,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.PROMOTION_COMMITTED,
        entityType: 'promotion_batch',
        entityId: id,
        after: { promoted, graduated },
      });
      return { promoted, graduated };
    });
    for (const account of accounts) await account.sendMail();
    return result;
  }

  /**
   * Undoes a commit within 24 hours: the new enrollments go, the old ones
   * reopen, graduates get their status back. Refused once anything uses a
   * new enrollment (subjects chosen, a transfer, attendance taken; marks
   * from M5 add theirs).
   */
  rollback(id: string): Promise<PromotionPreview> {
    return this.ds
      .runInTransaction(async () => {
        const batch = await this.batchRepo.findByIdOrFail(id);
        assertStatus(batch, PromotionBatchStatus.COMMITTED);
        if (
          !batch.committedAt ||
          Date.now() - batch.committedAt.getTime() > ROLLBACK_WINDOW_MS
        ) {
          throw new ConflictException({
            message: 'A promotion can only be rolled back within 24 hours',
            code: 'ROLLBACK_WINDOW_PASSED',
          });
        }
        const items = await this.itemRepo.findByBatch(id);
        const created = items
          .map((i) => i.newEnrollmentId)
          .filter((x): x is string => !!x);
        const used =
          (await this.enrollments.countSubjectChoices(created)) +
          (await this.enrollments.countChanges(created)) +
          (await this.attendance.countForEnrollments(created));
        if (used > 0) {
          throw new ConflictException({
            message: 'The new enrollments are already in use',
            code: 'PROMOTION_IN_USE',
          });
        }
        await this.enrollments.deleteMany(created);
        for (const item of items) {
          if (item.enrollmentId) {
            await this.enrollments.setStatus(
              item.enrollmentId,
              StudentEnrollmentStatus.ACTIVE,
            );
          }
          if (item.outcome === PromotionOutcome.GRADUATE) {
            await this.students.restoreStatus(
              item.studentId,
              (item.previousStatus as StudentStatus) ?? StudentStatus.ACTIVE,
              'Promotion rolled back',
            );
          }
          await this.itemRepo.updateFields(item.id, {
            newEnrollmentId: null,
            previousStatus: null,
          });
        }
        await this.batchRepo.updateFields(id, {
          status: PromotionBatchStatus.ROLLED_BACK,
          rolledBackAt: new Date(),
          rolledBackBy: this.context.current().userId,
        });
        await this.audit.record({
          action: AUDIT_ACTIONS.PROMOTION_ROLLED_BACK,
          entityType: 'promotion_batch',
          entityId: id,
          after: { enrollmentsRemoved: created.length },
        });
        return id;
      })
      .then((batchId) => this.preview(batchId));
  }

  // --- Building ------------------------------------------------------------

  private async buildItems(batch: PromotionBatch, cls: Class): Promise<void> {
    const enrollments = await this.enrollments.findActiveInClass(
      batch.fromYearId,
      batch.classId,
    );
    const nextClass = await this.nextClass(cls);
    const targets = nextClass
      ? await this.targetSections(batch.toYearId, nextClass.id)
      : [];

    const ordered = [...enrollments].sort((a, b) =>
      batch.options.rollBy === RollBy.ALPHABETICAL
        ? (a.student?.fullName ?? '').localeCompare(b.student?.fullName ?? '')
        : byRoll(a.rollNo, b.rollNo),
    );
    const placed = new Map<string, number>(); // section id → rolls given
    for (const [index, enrollment] of ordered.entries()) {
      if (!nextClass) {
        await this.saveItem(batch, enrollment, PromotionOutcome.GRADUATE, null);
        continue;
      }
      const section = this.pickSection(
        targets,
        enrollment,
        index,
        batch.options.shuffleSections,
      );
      let newRoll: string | null = null;
      if (section) {
        const n = (placed.get(section.id) ?? 0) + 1;
        placed.set(section.id, n);
        newRoll =
          batch.options.rollBy === RollBy.KEEP ? enrollment.rollNo : String(n);
      }
      await this.saveItem(batch, enrollment, PromotionOutcome.PROMOTE, {
        classId: nextClass.id,
        sectionId: section?.id ?? null,
        newRoll,
      });
    }
  }

  private saveItem(
    batch: PromotionBatch,
    enrollment: StudentEnrollment,
    outcome: PromotionOutcome,
    target: {
      classId: string;
      sectionId: string | null;
      newRoll: string | null;
    } | null,
  ) {
    return this.itemRepo.saveNew({
      batchId: batch.id,
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      outcome,
      toClassId: target?.classId ?? null,
      toSectionId: target?.sectionId ?? null,
      newRoll: target?.newRoll ?? null,
      overridden: false,
      note: null,
      newEnrollmentId: null,
      previousStatus: null,
    });
  }

  /** Same-name section when there is one (A → A), else spread evenly. */
  private pickSection(
    targets: Section[],
    enrollment: StudentEnrollment,
    index: number,
    shuffle: boolean,
  ): Section | null {
    if (!targets.length) return null;
    if (!shuffle) {
      const same = targets.find(
        (t) =>
          t.name.trim().toLowerCase() ===
          enrollment.section?.name.trim().toLowerCase(),
      );
      if (same) return same;
    }
    return targets[index % targets.length];
  }

  /** The next class up by level; null for the final class. */
  private async nextClass(cls: Class): Promise<Class | null> {
    if (cls.level === null) return null;
    const all = await this.classes.findAllOrdered();
    return (
      all.find((c) => c.isActive && c.level !== null && c.level > cls.level!) ??
      null
    );
  }

  private async targetClassId(
    batch: PromotionBatch,
    outcome: PromotionOutcome,
  ): Promise<string | null> {
    if (outcome === PromotionOutcome.GRADUATE) return null;
    if (outcome === PromotionOutcome.DETAIN) return batch.classId;
    const next = await this.nextClass(
      await this.classes.findById(batch.classId),
    );
    if (!next) {
      throw new BadRequestException({
        message:
          'This is the final class: students can only graduate or repeat',
        code: 'NO_NEXT_CLASS',
      });
    }
    return next.id;
  }

  private async targetSections(
    toYearId: string,
    classId: string,
  ): Promise<Section[]> {
    return (await this.sections.findInYear(toYearId))
      .filter((s) => s.classId === classId && s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * A draft is committable when every moving student has a section, rolls
   * don't repeat inside a section, and nobody is enrolled in the next
   * session already.
   */
  private async checkCommittable(
    id: string,
  ): Promise<{ batch: PromotionBatch; items: PromotionBatchItem[] }> {
    const batch = await this.batchRepo.findByIdOrFail(id);
    assertStatus(batch, PromotionBatchStatus.DRAFT);
    const items = await this.itemRepo.findByBatch(id);
    const problems: { itemId: string; studentId: string; code: string }[] = [];
    const rolls = new Set<string>();
    for (const item of items) {
      if (item.outcome === PromotionOutcome.GRADUATE) continue;
      if (!item.toSectionId) {
        problems.push({
          itemId: item.id,
          studentId: item.studentId,
          code: 'NO_SECTION',
        });
        continue;
      }
      if (item.newRoll) {
        const key = `${item.toSectionId}:${item.newRoll}`;
        if (rolls.has(key)) {
          problems.push({
            itemId: item.id,
            studentId: item.studentId,
            code: 'ROLL_REPEATED',
          });
        }
        rolls.add(key);
      }
      if (
        await this.enrollments.findForStudentYear(
          item.studentId,
          batch.toYearId,
        )
      ) {
        problems.push({
          itemId: item.id,
          studentId: item.studentId,
          code: 'ALREADY_ENROLLED',
        });
      }
    }
    if (problems.length) {
      throw new ConflictException({
        message: 'Fix the flagged students before committing',
        code: 'PROMOTION_NOT_READY',
        problems,
      });
    }
    return { batch, items };
  }
}

function assertStatus(batch: PromotionBatch, status: PromotionBatchStatus) {
  if (batch.status !== status) {
    throw new ConflictException({
      message: `The batch is ${batch.status}, not ${status}`,
      code: 'PROMOTION_WRONG_STATUS',
    });
  }
}
