import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DomainsConfig } from '~/config';

/** Prefix of the TXT record that proves ownership of a custom domain. */
export const DOMAIN_TXT_PREFIX = '_school-verify';

/** The subset of `node:dns/promises` used here, injectable for tests. */
export interface DnsResolver {
  resolveCname(hostname: string): Promise<string[]>;
  resolveTxt(hostname: string): Promise<string[][]>;
}

export const DNS_RESOLVER = Symbol('DNS_RESOLVER');

/** A DNS record the school has to create at its DNS provider. */
export interface DnsRecord {
  type: 'CNAME' | 'TXT';
  name: string;
  value: string;
}

export interface DnsCheckResult {
  /** `<hostname>` CNAMEs to the platform target. */
  cname: boolean;
  /** `_school-verify.<hostname>` TXT holds the domain's token. */
  txt: boolean;
}

/** Lookup failures that just mean "the record isn't there". */
const MISSING_RECORD_CODES = new Set(['ENODATA', 'ENOTFOUND', 'ENONAME']);

/**
 * Checks the two records a custom domain needs (doc/domains-and-routing.md,
 * section 7): a CNAME to the platform, and a TXT record with the domain's
 * verification token, which proves the school controls the DNS zone.
 */
@Injectable()
export class DomainDnsService {
  private readonly logger = new Logger(DomainDnsService.name);
  private readonly cnameTarget: string;

  constructor(
    @Inject(DNS_RESOLVER) private readonly resolver: DnsResolver,
    config: ConfigService,
  ) {
    this.cnameTarget = config.getOrThrow<DomainsConfig>('domains').cnameTarget;
  }

  /** The records to show the school for `hostname`. */
  records(hostname: string, verificationToken: string): DnsRecord[] {
    return [
      { type: 'CNAME', name: hostname, value: this.cnameTarget },
      {
        type: 'TXT',
        name: `${DOMAIN_TXT_PREFIX}.${hostname}`,
        value: verificationToken,
      },
    ];
  }

  async check(
    hostname: string,
    verificationToken: string,
  ): Promise<DnsCheckResult> {
    const [cnames, txts] = await Promise.all([
      this.lookup(() => this.resolver.resolveCname(hostname)),
      this.lookup(() =>
        this.resolver.resolveTxt(`${DOMAIN_TXT_PREFIX}.${hostname}`),
      ),
    ]);
    return {
      cname: cnames.some((c) => stripDot(c) === this.cnameTarget),
      // A TXT record may be split into several strings; join them back.
      txt: txts.some((chunks) => chunks.join('').trim() === verificationToken),
    };
  }

  private async lookup<T>(query: () => Promise<T[]>): Promise<T[]> {
    try {
      return await query();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (!code || !MISSING_RECORD_CODES.has(code)) {
        // SERVFAIL, timeouts…: treat as failing this time, but log it.
        this.logger.warn(`DNS lookup failed: ${code ?? String(err)}`);
      }
      return [];
    }
  }
}

function stripDot(name: string): string {
  return name.toLowerCase().replace(/\.$/, '');
}
