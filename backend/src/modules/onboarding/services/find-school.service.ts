import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeEmail } from '~/common/identity/identifier';
import { hashToken } from '~/common/tokens/secure-token.util';
import { JobHandler, JobQueue, QUEUES, type JobPayload } from '~/shared/queue';
import { MailService } from '~/shared/mail/mail.service';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';
import { MembershipStatus } from '~/modules/memberships/enums/membership-status.enum';
import { OrganizationDomain } from '~/modules/organizations/entities/organization-domain.entity';
import { RESOLVABLE_DOMAIN_STATUSES } from '~/modules/organizations/enums/domain-status.enum';
import { isOperationalOrganization } from '~/modules/organizations/enums/organization-status.enum';

export const FIND_SCHOOL_JOB = 'find-school';

/** Mails per recipient per window, so the form can't flood an inbox. */
const PER_RECIPIENT_LIMIT = 3;
const PER_RECIPIENT_WINDOW_MS = 60 * 60 * 1000;

interface FindSchoolJob {
  email: string;
}

/**
 * "Find your school" (PRD 6.2, doc/domains-and-routing.md 3): mails the
 * account's schools with sign-in links. The request always gets the same
 * answer and only enqueues; the job looks the account up, so neither the
 * response nor its timing reveals whether an account exists. Nothing is
 * sent to unknown addresses or accounts without an active school.
 *
 * Singleton (the job handler runs outside requests) on the root connection.
 * The per-recipient limit is in memory, per process.
 */
@Injectable()
export class FindSchoolService {
  private readonly logger = new Logger(FindSchoolService.name);
  private readonly sent = new Map<string, number[]>();

  constructor(
    private readonly queue: JobQueue,
    private readonly mail: MailService,
    private readonly hosts: AppHosts,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(OrganizationDomain)
    private readonly domains: Repository<OrganizationDomain>,
  ) {}

  async request(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (!this.allow(normalized)) return;
    await this.queue.enqueue<FindSchoolJob>(
      QUEUES.mail,
      FIND_SCHOOL_JOB,
      { orgId: null, actorUserId: null, data: { email: normalized } },
      // One pending job per address.
      { jobId: `find-school:${hashToken(normalized)}` },
    );
  }

  @JobHandler(QUEUES.mail, FIND_SCHOOL_JOB)
  async send(payload: JobPayload<FindSchoolJob>): Promise<void> {
    const { email } = payload.data;
    const user = await this.users.findOne({ where: { email } });
    if (!user || user.status !== UserStatus.ACTIVE) return;

    const memberships = await this.memberships.find({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
      relations: { organization: true },
    });
    const orgs = memberships
      .map((m) => m.organization)
      .filter((o) => isOperationalOrganization(o.status));
    if (!orgs.length) return;

    // A school's primary custom domain when it serves, else its subdomain.
    const primary = await this.domains.find({
      where: {
        orgId: In(orgs.map((o) => o.id)),
        isPrimary: true,
        status: In([...RESOLVABLE_DOMAIN_STATUSES]),
      },
    });
    const hostOf = new Map(primary.map((d) => [d.orgId, d.hostname]));
    const schools = orgs
      .map((o) => {
        const host = hostOf.get(o.id) ?? this.hosts.schoolHost(o.slug);
        return {
          name: o.name,
          host,
          link: this.hosts.url(
            host,
            `/login?identifier=${encodeURIComponent(email)}`,
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    await this.mail.sendFindSchoolEmail(email, { name: user.name, schools });
    this.logger.log(`Sent "find your school" with ${schools.length} school(s)`);
  }

  private allow(email: string): boolean {
    const now = Date.now();
    const key = hashToken(email);
    const recent = (this.sent.get(key) ?? []).filter(
      (t) => t > now - PER_RECIPIENT_WINDOW_MS,
    );
    if (recent.length >= PER_RECIPIENT_LIMIT) {
      this.sent.set(key, recent);
      return false;
    }
    recent.push(now);
    this.sent.set(key, recent);
    if (this.sent.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [k, times] of this.sent) {
      if (times.every((t) => t <= now - PER_RECIPIENT_WINDOW_MS)) {
        this.sent.delete(k);
      }
    }
  }
}
