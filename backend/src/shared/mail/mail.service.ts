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

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    await this.send(to, 'Reset your password', 'password-reset', {
      name,
      link,
    });
  }

  private get appUrl(): string {
    return this.config.get<MailerConfig>('mailer')!.appUrl;
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
