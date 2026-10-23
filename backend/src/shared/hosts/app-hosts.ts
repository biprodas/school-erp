import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DomainsConfig, MailerConfig } from '~/config';

/**
 * Hosts of the product (doc/domains-and-routing.md, section 1) and absolute
 * URLs on them. The protocol and port come from `APP_URL`, so dev links
 * read `http://acme.lvh.me:3000/…` and production ones `https://acme.<root>/…`.
 */
@Injectable()
export class AppHosts {
  constructor(private readonly config: ConfigService) {}

  /** `ROOT_DOMAIN`: the marketing site, signup and "Find your school". */
  get rootDomain(): string {
    return this.config.get<DomainsConfig>('domains')!.rootDomain;
  }

  /** The platform admin host. */
  get adminHost(): string {
    return `admin.${this.rootDomain}`;
  }

  schoolHost(slug: string): string {
    return `${slug}.${this.rootDomain}`;
  }

  /** The slug when `host` is `<slug>.<root>`, else null. */
  slugOf(host: string): string | null {
    const suffix = `.${this.rootDomain}`;
    if (!host.endsWith(suffix)) return null;
    const label = host.slice(0, -suffix.length);
    return label && !label.includes('.') ? label : null;
  }

  /** `https://<host>[:port]<path>`; `path` starts with `/`. */
  url(host: string, path = '/'): string {
    const base = new URL(
      this.config.get<MailerConfig>('mailer')?.appUrl ??
        'http://localhost:3000',
    );
    const port = base.port ? `:${base.port}` : '';
    return `${base.protocol}//${host}${port}${path}`;
  }
}

/** Global so any module can build links without importing anything. */
@Global()
@Module({ providers: [AppHosts], exports: [AppHosts] })
export class HostsModule {}
