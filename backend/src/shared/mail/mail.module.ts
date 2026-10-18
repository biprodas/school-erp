import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import type { MailerConfig } from '~/config';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

/**
 * Email infrastructure. Wraps `@nestjs-modules/mailer` (Nodemailer + Handlebars)
 * and exposes the domain-level {@link MailService}. Global so any platform or
 * tenanted module can inject `MailService` without re-importing.
 */
@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = config.get<MailerConfig>('mailer')!;
        return {
          transport: {
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            // Omit auth entirely when no user is set (Mailpit/local dev).
            ...(cfg.user ? { auth: { user: cfg.user, pass: cfg.pass } } : {}),
          },
          defaults: { from: `"${cfg.fromName}" <${cfg.fromAddress}>` },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
  // The dev/mail endpoints are unauthenticated, so they only exist outside production.
  controllers: process.env.NODE_ENV === 'production' ? [] : [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
