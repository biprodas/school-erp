import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailerConfig } from '~/config';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { DEFAULT_LOCALE, isLocale, type Locale } from '~/shared/locale/locales';

type AccountEmail =
  | 'activation'
  | 'welcome'
  | 'emailVerification'
  | 'passwordReset'
  | 'signupVerification'
  | 'findSchool'
  | 'dataExport';

/** One account email's words, `mail.<email>` in `src/i18n/<locale>/mail.json`. */
interface AccountEmailText {
  subject: string;
  greeting: string;
  paragraphs: string[];
  /** The call-to-action button, for emails that carry a link. */
  button?: string;
  footer: string;
}

/**
 * Domain-level email API. Each account email is one entry of the `mail`
 * translations (nestjs-i18n), rendered in a single language through the
 * shared `templates/account.hbs` layout. The language is the `locale` a
 * caller passes (the recipient's, e.g. the school's language for an
 * invite), else the current request's (`I18nContext`: `x-locale`, then
 * `Accept-Language`), else English. Sends are best-effort: a transport
 * failure is logged and swallowed so it never breaks the request flow that
 * triggered it.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async sendActivationEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug: string,
    locale?: Locale,
  ): Promise<void> {
    // On the school's own host, where the activate page and its session live.
    const link = this.buildLink(`/activate?token=${token}`, tenantSlug);
    await this.sendAccount(to, 'activation', { name }, { link, locale });
  }

  async sendWelcomeEmail(
    to: string,
    name: string,
    locale?: Locale,
  ): Promise<void> {
    await this.sendAccount(to, 'welcome', { name }, { locale });
  }

  async sendEmailVerificationEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug?: string,
    locale?: Locale,
  ): Promise<void> {
    const link = this.buildLink(`/verify-email?token=${token}`, tenantSlug);
    await this.sendAccount(to, 'emailVerification', { name }, { link, locale });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    tenantSlug?: string,
    locale?: Locale,
  ): Promise<void> {
    const link = this.buildLink(`/reset-password?token=${token}`, tenantSlug);
    await this.sendAccount(to, 'passwordReset', { name }, { link, locale });
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
    locale?: Locale,
  ): Promise<void> {
    const { link, ...vars } = context;
    await this.sendAccount(to, 'signupVerification', vars, { link, locale });
  }

  /** "Find your school": sign-in links to every school of the account. */
  async sendFindSchoolEmail(
    to: string,
    context: {
      name: string;
      schools: { name: string; host: string; link: string }[];
    },
    locale?: Locale,
  ): Promise<void> {
    await this.sendAccount(
      to,
      'findSchool',
      { name: context.name },
      { schools: context.schools, locale },
    );
  }

  /** The school's data export is ready (PRD 6.24). */
  async sendDataExportReady(
    to: string,
    name: string,
    link: string,
    locale?: Locale,
  ): Promise<void> {
    await this.sendAccount(to, 'dataExport', { name }, { link, locale });
  }

  /**
   * A notification email (PRD 6.13), already written in `locale` by
   * `NotificationService`; only the layout's button is translated here.
   * Unlike the account emails this throws on a transport failure, so the
   * delivery job can retry and log it. Returns the provider's message id.
   */
  async deliverNotification(
    to: string,
    subject: string,
    body: string,
    options: { link?: string | null; schoolName: string; locale?: Locale },
  ): Promise<string | null> {
    const locale = this.localeFor(options.locale);
    const info = (await this.mailer.sendMail({
      to,
      subject,
      template: 'notification',
      context: {
        lang: locale,
        subject,
        paragraphs: body.split(/\n+/).filter(Boolean),
        link: options.link ?? null,
        openLabel: this.i18n.t('mail.common.open', { lang: locale }),
        schoolName: options.schoolName,
      },
    })) as { messageId?: string } | undefined;
    return info?.messageId ?? null;
  }

  /** The caller's choice, else the request's language, else English. */
  private localeFor(locale?: Locale): Locale {
    if (locale) return locale;
    const requested = I18nContext.current()?.lang;
    return isLocale(requested) ? requested : DEFAULT_LOCALE;
  }

  private async sendAccount(
    to: string,
    email: AccountEmail,
    vars: Record<string, string>,
    options: {
      link?: string;
      schools?: { name: string; host: string; link: string }[];
      locale?: Locale;
    },
  ): Promise<void> {
    const locale = this.localeFor(options.locale);
    // The texts may carry markup (`<strong>`), so the body gets escaped
    // values and is rendered raw; the subject is plain text.
    const escaped = Object.fromEntries(
      Object.entries(vars).map(([key, value]) => [key, escapeHtml(value)]),
    );
    const text = this.i18n.t<string, AccountEmailText>(`mail.${email}`, {
      lang: locale,
      args: escaped,
    });
    const subject = this.i18n.t<string, string>(`mail.${email}.subject`, {
      lang: locale,
      args: vars,
    });
    await this.send(
      to,
      subject,
      'account',
      {
        lang: locale,
        subject,
        greeting: text.greeting,
        paragraphs: text.paragraphs,
        button: text.button ?? null,
        link: options.link ?? null,
        linkFallback: this.i18n.t('mail.common.linkFallback', { lang: locale }),
        schools: options.schools ?? [],
        footer: text.footer,
      },
      `${email} (${locale})`,
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

  private async send(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    label = template,
  ): Promise<void> {
    try {
      await this.mailer.sendMail({ to, subject, template, context });
      this.logger.log(`Sent "${label}" email to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send "${label}" email to ${to}`,
        err as Error,
      );
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
