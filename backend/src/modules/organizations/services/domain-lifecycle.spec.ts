import { OrganizationDomain } from '../entities/organization-domain.entity';
import { DomainStatus } from '../enums/domain-status.enum';
import { applyDnsCheck, DNS_FAILURE_GRACE_MS } from './domain-lifecycle';

const PASS = { cname: true, txt: true };
const FAIL = { cname: true, txt: false };
const NOW = new Date('2026-10-18T12:00:00Z');

const makeDomain = (overrides: Partial<OrganizationDomain> = {}) =>
  ({
    hostname: 'erp.test.edu',
    status: DomainStatus.PENDING,
    verifiedAt: null,
    lastCheckedAt: null,
    dnsFailingSince: null,
    ...overrides,
  }) as OrganizationDomain;

describe('applyDnsCheck', () => {
  it('verifies a pending domain whose records pass', () => {
    const domain = makeDomain();
    expect(applyDnsCheck(domain, PASS, NOW)).toBe(true);
    expect(domain).toMatchObject({
      status: DomainStatus.VERIFIED,
      verifiedAt: NOW,
      lastCheckedAt: NOW,
    });
  });

  it('needs both records: a CNAME alone does not verify', () => {
    const domain = makeDomain();
    expect(applyDnsCheck(domain, FAIL, NOW)).toBe(false);
    expect(domain.status).toBe(DomainStatus.PENDING);
    expect(domain.dnsFailingSince).toBeNull();
    expect(domain.lastCheckedAt).toBe(NOW);
  });

  it('starts a failure streak on a verified domain without changing status', () => {
    const domain = makeDomain({ status: DomainStatus.ACTIVE });
    expect(applyDnsCheck(domain, FAIL, NOW)).toBe(false);
    expect(domain.status).toBe(DomainStatus.ACTIVE);
    expect(domain.dnsFailingSince).toBe(NOW);
  });

  it('marks a domain inactive once it has failed for the grace period', () => {
    const since = new Date(NOW.getTime() - DNS_FAILURE_GRACE_MS);
    const domain = makeDomain({
      status: DomainStatus.VERIFIED,
      dnsFailingSince: since,
    });
    expect(applyDnsCheck(domain, FAIL, NOW)).toBe(true);
    expect(domain.status).toBe(DomainStatus.INACTIVE);
    expect(domain.dnsFailingSince).toBe(since);
  });

  it('clears the streak when records pass again, keeping the status', () => {
    const verifiedAt = new Date('2026-01-01T00:00:00Z');
    const domain = makeDomain({
      status: DomainStatus.ACTIVE,
      verifiedAt,
      dnsFailingSince: new Date(NOW.getTime() - 1000),
    });
    expect(applyDnsCheck(domain, PASS, NOW)).toBe(false);
    expect(domain).toMatchObject({
      status: DomainStatus.ACTIVE,
      verifiedAt,
      dnsFailingSince: null,
    });
  });

  it('re-verifies an inactive domain whose records are back', () => {
    const domain = makeDomain({ status: DomainStatus.INACTIVE });
    expect(applyDnsCheck(domain, PASS, NOW)).toBe(true);
    expect(domain.status).toBe(DomainStatus.VERIFIED);
  });
});
