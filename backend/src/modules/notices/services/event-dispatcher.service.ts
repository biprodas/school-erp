import { Injectable, Logger } from '@nestjs/common';
import { DOMAIN_EVENTS } from '~/modules/domain-events/domain-events';
import type { DomainEvent } from '~/modules/domain-events/entities/domain-event.entity';
import { DomainEventService } from '~/modules/domain-events/domain-event.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import { NotificationService } from '~/modules/notifications/services/notification.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { StudentService } from '~/modules/students/services/student.service';

/** The events this dispatcher turns into notifications. */
export const DISPATCHED_EVENTS = [
  DOMAIN_EVENTS.RESULTS_PUBLISHED,
  DOMAIN_EVENTS.PAYMENT_RECEIVED,
  DOMAIN_EVENTS.FEES_DUE_REMINDER,
] as const;

/** Minor units as `1,234.50 BDT`. */
const money = (minor: number, currency: string) =>
  `${(minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

/**
 * Reads the domain event outbox and notifies families (PRD 6.13
 * automated notices, Phase 1a channels): results published, payment
 * received, fees due. Each event is processed once and marked; one that
 * fails stays pending for the next run. `attendance.submitted` waits for
 * the Phase 1b absentee alerts.
 */
@Injectable()
export class EventDispatcherService {
  private readonly logger = new Logger(EventDispatcherService.name);

  constructor(
    private readonly events: DomainEventService,
    private readonly notifications: NotificationService,
    private readonly guardians: GuardianService,
    private readonly students: StudentService,
    private readonly enrollments: EnrollmentService,
    private readonly settings: SettingsService,
  ) {}

  async process(limit = 200): Promise<number> {
    let done = 0;
    for (const event of await this.events.pending(
      [...DISPATCHED_EVENTS],
      limit,
    )) {
      try {
        await this.handle(event);
        await this.events.markProcessed(event.id);
        done++;
      } catch (err) {
        this.logger.error(
          `Event ${event.type} ${event.id} failed: ${String(err)}`,
        );
      }
    }
    return done;
  }

  private async handle(event: DomainEvent): Promise<void> {
    const p = event.payload;
    const text = (key: string) => (typeof p[key] === 'string' ? p[key] : '');
    switch (event.type) {
      case DOMAIN_EVENTS.RESULTS_PUBLISHED: {
        const enrollments = await this.enrollments.findByIds(
          p.enrollmentIds as string[],
        );
        await this.perStudent(
          enrollments.map((e) => e.studentId),
          'resultPublished',
          (s) => ({
            student_name: s.fullName,
            result_name: text('resultName'),
          }),
          (studentId) => `/portal/children/${studentId}/results`,
        );
        return;
      }
      case DOMAIN_EVENTS.PAYMENT_RECEIVED: {
        const { currency } = await this.settings.getSection('locale');
        const studentIds = p.studentIds as string[];
        const names = (await this.students.findManyByIds(studentIds)).map(
          (s) => s.fullName,
        );
        const family = await this.guardians.familyUserIds(studentIds);
        await this.notifications.notify({
          userIds: [...new Set([...family.values()].flat())],
          key: 'paymentReceived',
          vars: {
            amount: money(Number(p.amount), currency),
            receipt_number: text('receiptNumber'),
            student_name: names.join(', '),
          },
          link: '/portal/payments',
          data: { receiptId: p.receiptId },
        });
        return;
      }
      case DOMAIN_EVENTS.FEES_DUE_REMINDER: {
        const { currency } = await this.settings.getSection('locale');
        await this.perStudent(
          [p.studentId as string],
          'feeDue',
          (s) => ({
            student_name: s.fullName,
            invoice_number: text('invoiceNumber'),
            amount: money(Number(p.outstanding), currency),
            due_date: text('dueDate'),
          }),
          (studentId) => `/portal/children/${studentId}/fees`,
        );
        return;
      }
    }
  }

  /** One notification per student to the student's family. */
  private async perStudent(
    studentIds: string[],
    key: 'resultPublished' | 'feeDue',
    vars: (s: { fullName: string }) => Record<string, string>,
    link: (studentId: string) => string,
  ): Promise<void> {
    const family = await this.guardians.familyUserIds(studentIds);
    for (const s of await this.students.findManyByIds(studentIds)) {
      const userIds = family.get(s.id) ?? [];
      if (!userIds.length) continue;
      await this.notifications.notify({
        userIds,
        key,
        vars: vars(s),
        link: link(s.id),
        data: { studentId: s.id },
      });
    }
  }
}
