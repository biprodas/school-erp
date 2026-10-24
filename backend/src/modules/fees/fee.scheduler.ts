import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { localDate } from '~/shared/dates/local-date';
import { TenantJobRunner } from '~/tenancy/tenant-job.runner';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OPERATIONAL_ORGANIZATION_STATUSES } from '~/modules/organizations/enums/organization-status.enum';
import { OrgSettingsReader } from '~/modules/settings/services/org-settings.reader';
import { BillingService } from './services/billing.service';
import { FeeIntegrityService } from './services/fee-integrity.service';
import { FeeReportService } from './services/fee-report.service';
import { LateFineService } from './services/late-fine.service';

export const FEE_SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;
/** The school's local hour the integrity check runs at. */
const INTEGRITY_HOUR = 2;

export interface FeeSchedulerRun {
  orgId: string;
  billed: boolean;
  fines: number;
  reminders: number;
  integrityChecked: boolean;
}

/**
 * The fee calendar for every operational school, hourly:
 * - on or after the billing day, the month's invoices (once per period:
 *   an automatic `billing_runs` row);
 * - late fines and due reminders (both idempotent);
 * - at 02:00 local time, the totals integrity check.
 * Each school runs as itself through `TenantJobRunner` (RLS applies).
 */
@Injectable()
export class FeeScheduler {
  private readonly logger = new Logger(FeeScheduler.name);
  private running = false;

  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly settings: OrgSettingsReader,
    private readonly runner: TenantJobRunner,
  ) {}

  @Interval('fees-calendar', FEE_SCHEDULER_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce(new Date());
    } catch (err) {
      this.logger.error(`Fee scheduler failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(now: Date, orgIds?: string[]): Promise<FeeSchedulerRun[]> {
    const orgs = await this.organizations.find({
      where: {
        status: In([...OPERATIONAL_ORGANIZATION_STATUSES]),
        ...(orgIds && { id: In(orgIds) }),
      },
      select: { id: true },
    });
    const runs: FeeSchedulerRun[] = [];
    for (const { id } of orgs) {
      try {
        runs.push(await this.runOrg(id, now));
      } catch (err) {
        this.logger.error(`Fee scheduler failed for ${id}: ${String(err)}`);
      }
    }
    return runs;
  }

  private async runOrg(orgId: string, now: Date): Promise<FeeSchedulerRun> {
    const values = await this.settings.get(orgId);
    const today = localDate(values.locale.timeZone, now);
    const period = today.slice(0, 7);
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: values.locale.timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    return this.runner.run(orgId, async (resolve) => {
      const run: FeeSchedulerRun = {
        orgId,
        billed: false,
        fines: 0,
        reminders: 0,
        integrityChecked: false,
      };
      const billing = await resolve(BillingService);
      if (
        Number(today.slice(8)) >= values.fees.billingDay &&
        !(await billing.autoRunExists(period))
      ) {
        try {
          await billing.generate({ period, classIds: [], automatic: true });
          run.billed = true;
        } catch (err) {
          // Outside the session, or another instance just billed it.
          this.logger.debug(
            `Auto billing skipped for ${orgId}: ${String(err)}`,
          );
        }
      }
      run.fines = await (await resolve(LateFineService)).apply(today);
      run.reminders = await (
        await resolve(FeeReportService)
      ).queueReminders(today);
      if (hour === INTEGRITY_HOUR) {
        await (await resolve(FeeIntegrityService)).check();
        run.integrityChecked = true;
      }
      return run;
    });
  }
}
