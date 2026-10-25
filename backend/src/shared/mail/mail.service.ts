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
    // On the school's own host, where the activate page and its session live.
    const link = this.buildLink(`/activate?token=${token}`, tenantSlug);
    await this.send(
      to,
      'Activate your account · অ্যাকাউন্ট চালু করুন',
      'activation',
      { name, link },
    );
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.send(
      to,
      'Welcome to School ERP · School ERP-তে স্বাগতম',
      'welcome',
      { name },
    );
  }

  async sendEmailVerificationEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug?: string,
  ): Promise<void> {
    const link = this.buildLink(`/verify-email?token=${token}`, tenantSlug);
    await this.send(
      to,
      'Verify your email · ইমেইল নিশ্চিত করুন',
      'email-verification',
      {
        name,
        link,
      },
    );
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug?: string,
  ): Promise<void> {
    const link = this.buildLink(`/reset-password?token=${token}`, tenantSlug);
    await this.send(
      to,
      'Reset your password · পাসওয়ার্ড রিসেট করুন',
      'password-reset',
      {
        name,
        link,
      },
    );
  }

  /** Self-serve signup: the link that creates the school (PRD 6.2). */
  async sendSignupVerificationEmail(
    to: string,
    context: {
      name: string;
      schoolName: string;
      schoolHost: string;
      link: string;
    },
  ): Promise<void> {
    await this.send(
      to,
      `Confirm your signup for ${context.schoolName} · সাইনআপ নিশ্চিত করুন`,
      'signup-verification',
      context,
    );
  }

  /** "Find your school": sign-in links to every school of the account. */
  async sendFindSchoolEmail(
    to: string,
    context: {
      name: string;
      schools: { name: string; host: string; link: string }[];
    },
  ): Promise<void> {
    await this.send(
      to,
      'Your schools on School ERP · School ERP-তে আপনার স্কুল',
      'find-school',
      context,
    );
  }

  /**
   * Absolute frontend URL for `path` (a path-with-query like
   * `/reset-password?token=…`). When a root domain is configured, the link is
   * built under it — on the tenant's subdomain (`{slug}.{rootDomain}`) when a
   * slug is given, or on the platform apex (`{rootDomain}`) otherwise — reusing
   * appUrl's protocol + port so the host carries the right surface. Without a
   * root domain it falls back to appUrl, appending a `&tenant=` hint for tenants.
   */
  private buildLink(path: string, tenantSlug?: string): string {
    const { rootDomain } = this;
    if (rootDomain) {
      const base = new URL(this.appUrl);
      const portSuffix = base.port ? `:${base.port}` : '';
      const host = tenantSlug ? `${tenantSlug}.${rootDomain}` : rootDomain;
      return `${base.protocol}//${host}${portSuffix}${path}`;
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

  /** The school's data export is ready (PRD 6.24). */
  async sendDataExportReady(
    to: string,
    name: string,
    link: string,
  ): Promise<void> {
    await this.send(
      to,
      'Your data export is ready · আপনার ডেটা এক্সপোর্ট প্রস্তুত',
      'data-export',
      { name, link },
    );
  }

  /**
   * A notification email (PRD 6.13). Unlike the account emails this throws
   * on a transport failure, so the delivery job can retry and log it.
   * Returns the provider's message id.
   */
  async deliverNotification(
    to: string,
    subject: string,
    body: string,
    options: { link?: string | null; schoolName: string },
  ): Promise<string | null> {
    const info = (await this.mailer.sendMail({
      to,
      subject,
      template: 'notification',
      context: {
        subject,
        paragraphs: body.split(/\n+/).filter(Boolean),
        link: options.link ?? null,
        schoolName: options.schoolName,
      },
    })) as { messageId?: string } | undefined;
    return info?.messageId ?? null;
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
