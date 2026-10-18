import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
import type { DomainsConfig } from '~/config';
import { generateToken } from '~/common/tokens/secure-token.util';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { tenantDomainCache } from '~/tenancy/tenant-slug.cache';
import { AddDomainDto } from '../dto/add-domain.dto';
import { OrganizationDomain } from '../entities/organization-domain.entity';
import {
  DomainStatus,
  RESOLVABLE_DOMAIN_STATUSES,
} from '../enums/domain-status.enum';
import { OrganizationDomainRepository } from '../repositories/organization-domain.repository';
import {
  DnsCheckResult,
  DnsRecord,
  DomainDnsService,
} from './domain-dns.service';
import { applyDnsCheck } from './domain-lifecycle';
import { normalizeHostname } from './organization.service';

export type DomainView = OrganizationDomain & { dnsRecords: DnsRecord[] };

/**
 * A school's own custom domains (Settings → Domain): add a host, show the DNS
 * records to create, verify them on demand, choose the primary domain and
 * remove domains. The periodic re-check lives in `DomainCheckScheduler`.
 */
@Injectable()
export class OrganizationDomainService {
  private readonly config: DomainsConfig;

  constructor(
    private readonly domainRepo: OrganizationDomainRepository,
    private readonly dns: DomainDnsService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
    config: ConfigService,
  ) {
    this.config = config.getOrThrow<DomainsConfig>('domains');
  }

  async list(): Promise<DomainView[]> {
    const domains = await this.domainRepo.findAllOrdered();
    return domains.map((d) => this.view(d));
  }

  async add(dto: AddDomainDto): Promise<DomainView> {
    const hostname = normalizeHostname(dto.hostname);
    const root = this.config.rootDomain;
    if (hostname === root || hostname.endsWith(`.${root}`)) {
      throw new BadRequestException(
        `Addresses under ${root} are provided automatically`,
      );
    }
    if ((await this.domainRepo.count()) >= this.config.maxPerOrg) {
      throw new BadRequestException(
        `A school can have at most ${this.config.maxPerOrg} custom domains`,
      );
    }
    if (await this.domainRepo.findByHostname(hostname)) {
      throw new ConflictException('This domain has already been added');
    }

    try {
      const domain = await this.domainRepo.saveNew({
        hostname,
        verificationToken: generateToken(),
      });
      return this.view(domain);
    } catch (err) {
      // Unique across all schools; another school's row is invisible here.
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          'This domain is already in use by another school',
        );
      }
      throw err;
    }
  }

  /** Checks the DNS records now; a passing check verifies the domain. */
  async verify(id: string): Promise<DomainView & { check: DnsCheckResult }> {
    const domain = await this.domainRepo.findByIdOrFail(id);
    const check = await this.dns.check(
      domain.hostname,
      domain.verificationToken,
    );
    if (applyDnsCheck(domain, check, new Date())) {
      tenantDomainCache.invalidate(domain.hostname);
    }
    await this.domainRepo.save(domain);
    return { ...this.view(domain), check };
  }

  /** Makes a verified domain the school's primary (canonical) domain. */
  async setPrimary(id: string): Promise<DomainView> {
    const domain = await this.domainRepo.findByIdOrFail(id);
    if (!isResolvable(domain.status)) {
      throw new BadRequestException(
        'Verify the domain before making it primary',
      );
    }
    if (domain.isPrimary) return this.view(domain);

    return this.ds.runInTransaction(async () => {
      await this.domainRepo.clearPrimary();
      domain.isPrimary = true;
      return this.view(await this.domainRepo.save(domain));
    });
  }

  async remove(id: string): Promise<void> {
    const domain = await this.domainRepo.findByIdOrFail(id);
    await this.domainRepo.deleteById(id);
    tenantDomainCache.invalidate(domain.hostname);
  }

  private view(domain: OrganizationDomain): DomainView {
    return Object.assign(domain, {
      dnsRecords: this.dns.records(domain.hostname, domain.verificationToken),
    });
  }
}

function isResolvable(status: DomainStatus): boolean {
  return (RESOLVABLE_DOMAIN_STATUSES as readonly DomainStatus[]).includes(
    status,
  );
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string } | undefined)?.code === '23505'
  );
}
