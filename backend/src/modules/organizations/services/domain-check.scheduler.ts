import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { tenantDomainCache } from '~/tenancy/tenant-slug.cache';
import { OrganizationDomain } from '../entities/organization-domain.entity';
import { DomainStatus } from '../enums/domain-status.enum';
import { DomainDnsService } from './domain-dns.service';
import { applyDnsCheck } from './domain-lifecycle';

/** How often the job runs. */
export const DOMAIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** Pending domains are checked automatically for this long after being added. */
export const PENDING_CHECK_WINDOW_MS = 72 * 60 * 60 * 1000;
/** Verified/active domains are re-checked at most this often. */
export const LIVE_RECHECK_MS = 60 * 60 * 1000;
/** Domains checked per run, oldest check first. */
const BATCH_SIZE = 100;

/**
 * Periodic DNS check for every school's custom domains. Platform-level, so
 * it reads `organization_domains` through the root connection (all orgs):
 * - pending domains, every run, for 72 hours after they were added (after
 *   that the school uses "Verify" in Settings);
 * - verified/active domains, about hourly, so a domain whose records were
 *   removed goes inactive after the grace period (`applyDnsCheck`).
 */
@Injectable()
export class DomainCheckScheduler {
  private readonly logger = new Logger(DomainCheckScheduler.name);
  private running = false;

  constructor(
    @InjectRepository(OrganizationDomain)
    private readonly domainRepo: Repository<OrganizationDomain>,
    @Inject(DomainDnsService) private readonly dns: DomainDnsService,
  ) {}

  @Interval('custom-domain-dns-check', DOMAIN_CHECK_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce(new Date());
    } catch (err) {
      this.logger.error(`Domain DNS check failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  /** One pass over the domains that are due. Returns how many were checked. */
  async runOnce(now: Date): Promise<number> {
    const live = In([DomainStatus.VERIFIED, DomainStatus.ACTIVE]);
    const due = await this.domainRepo.find({
      where: [
        {
          status: DomainStatus.PENDING,
          createdAt: MoreThan(
            new Date(now.getTime() - PENDING_CHECK_WINDOW_MS),
          ),
        },
        { status: live, lastCheckedAt: IsNull() },
        {
          status: live,
          lastCheckedAt: LessThan(new Date(now.getTime() - LIVE_RECHECK_MS)),
        },
      ],
      order: { lastCheckedAt: { direction: 'ASC', nulls: 'FIRST' } },
      take: BATCH_SIZE,
    });

    for (const domain of due) {
      const check = await this.dns.check(
        domain.hostname,
        domain.verificationToken,
      );
      const before = domain.status;
      if (applyDnsCheck(domain, check, now)) {
        tenantDomainCache.invalidate(domain.hostname);
        this.logger.log(
          `Domain ${domain.hostname} (org ${domain.orgId}): ${before} → ${domain.status}`,
        );
      }
      await this.domainRepo.save(domain);
    }
    return due.length;
  }
}
