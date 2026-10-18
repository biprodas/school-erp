import { OrganizationDomain } from '../entities/organization-domain.entity';
import { DomainStatus } from '../enums/domain-status.enum';
import type { DnsCheckResult } from './domain-dns.service';

/** How long a verified domain may fail its DNS check before going inactive. */
export const DNS_FAILURE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Applies one DNS check to a domain (doc/domains-and-routing.md, section 7):
 * - both records pass: a pending or inactive domain becomes verified, and
 *   any failure streak is cleared;
 * - a check fails on a verified/active domain: the failure streak starts,
 *   and once it is older than the grace period the domain becomes inactive
 *   (it stops resolving and traffic falls back to the subdomain);
 * - a pending domain that fails simply stays pending.
 *
 * Mutates `domain` and returns whether its status changed.
 */
export function applyDnsCheck(
  domain: OrganizationDomain,
  result: DnsCheckResult,
  now: Date,
): boolean {
  const before = domain.status;
  domain.lastCheckedAt = now;

  if (result.cname && result.txt) {
    domain.dnsFailingSince = null;
    if (
      domain.status === DomainStatus.PENDING ||
      domain.status === DomainStatus.INACTIVE
    ) {
      domain.status = DomainStatus.VERIFIED;
      domain.verifiedAt = now;
    }
  } else if (
    domain.status === DomainStatus.VERIFIED ||
    domain.status === DomainStatus.ACTIVE
  ) {
    domain.dnsFailingSince ??= now;
    if (
      now.getTime() - domain.dnsFailingSince.getTime() >=
      DNS_FAILURE_GRACE_MS
    ) {
      domain.status = DomainStatus.INACTIVE;
    }
  }

  return domain.status !== before;
}
