import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailerConfig } from '~/config';

/**
 * Domain-level email API. Each method maps a use-case to a Handlebars template
 * under `templates/`. Sends are best-effort: a transport failure is logged and
 * swallowed so it never breaks the request flow that triggered it.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendActivationEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug: string,
  ): Promise<void> {
    const link = `${this.appUrl}/activate?token=${token}&tenant=${tenantSlug}`;
    await this.send(to, 'Activate your account', 'activation', { name, link });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.send(to, 'Welcome to School ERP', 'welcome', { name });
  }

  async sendEmailVerificationEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug?: string,
  ): Promise<void> {
    const link = this.buildLink(`/verify-email?token=${token}`, tenantSlug);
    await this.send(to, 'Verify your email', 'email-verification', {
      name,
      link,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug?: string,
  ): Promise<void> {
    const link = this.buildLink(`/reset-password?token=${token}`, tenantSlug);
    await this.send(to, 'Reset your password', 'password-reset', {
      name,
      link,
    });
  }

  /**
   * Absolute frontend URL for `path` (a path-with-query like
   * `/reset-password?token=…`). When a tenant slug and a configured root domain
   * are both present, the link is built on the tenant's subdomain
   * (`{slug}.{rootDomain}`) reusing appUrl's protocol + port, so the host itself
   * carries the tenant. Otherwise it falls back to appUrl, appending a
   * `&tenant=` hint so the frontend can still scope the request.
   */
  private buildLink(path: string, tenantSlug?: string): string {
    const { rootDomain } = this;
    if (tenantSlug && rootDomain) {
      const base = new URL(this.appUrl);
      const portSuffix = base.port ? `:${base.port}` : '';
      return `${base.protocol}//${tenantSlug}.${rootDomain}${portSuffix}${path}`;
    }
    const link = `${this.appUrl}${path}`;
    return tenantSlug ? `${link}&tenant=${tenantSlug}` : link;
  }

  private get appUrl(): string {
    return this.config.get<MailerConfig>('mailer')!.appUrl;
  }

  private get rootDomain(): string | undefined {
    return this.config.get<MailerConfig>('mailer')!.rootDomain;
  }

  private async send(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.mailer.sendMail({ to, subject, template, context });
      this.logger.log(`Sent "${template}" email to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send "${template}" email to ${to}`,
        err as Error,
      );
    }
  }
}
