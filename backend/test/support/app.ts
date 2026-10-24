import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { MailService } from '~/shared/mail/mail.service';
import { SessionService } from '~/modules/auth/services/session.service';
import { UserStatus } from '~/modules/users/enums/user-status.enum';

/** One email the app tried to send. */
export interface SentMail {
  method: string;
  to: string;
  args: unknown[];
}

/**
 * `MailService` that records instead of sending, so specs can read links
 * (signup verification, "Find your school").
 */
export class MailCapture {
  sent: SentMail[] = [];

  readonly service = Object.fromEntries(
    [
      'sendActivationEmail',
      'sendWelcomeEmail',
      'sendEmailVerificationEmail',
      'sendPasswordResetEmail',
      'sendSignupVerificationEmail',
      'sendFindSchoolEmail',
      'deliverNotification',
    ].map((method) => [
      method,
      (to: string, ...args: unknown[]) => {
        this.sent.push({ method, to, args });
        return Promise.resolve();
      },
    ]),
  ) as unknown as MailService;

  to(address: string, method?: string): SentMail[] {
    return this.sent.filter(
      (m) => m.to === address && (!method || m.method === method),
    );
  }
}

export interface E2eApp {
  app: INestApplication<App>;
  rootDs: DataSource;
  jwt: JwtService;
  mail: MailCapture;
  http: () => ReturnType<typeof request>;
  /** A platform access token with a real (revocable) session. */
  platformToken: (userId: string, isAdmin?: boolean) => Promise<string>;
  close: () => Promise<void>;
}

/**
 * Boots the whole app against the e2e database with mail captured and rate
 * limits off (these specs call public endpoints many times). `env` is set
 * before boot and restored on `close`.
 */
export async function bootApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
  env: Record<string, string> = {},
): Promise<E2eApp> {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries({
    RATE_LIMIT_ENABLED: 'false',
    ...env,
  })) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }

  const mail = new MailCapture();
  const moduleRef = await customize(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail.service),
  ).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const rootDs = app.get<DataSource>(getDataSourceToken());
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const sessions = app.get(SessionService);

  return {
    app,
    rootDs,
    jwt,
    mail,
    http: () => request(app.getHttpServer()),
    platformToken: async (userId, isAdmin = false) => {
      const { sessionId } = await sessions.start(userId, null);
      return jwt.sign({
        sub: userId,
        status: UserStatus.ACTIVE,
        isAdmin,
        sid: sessionId,
      });
    },
    close: async () => {
      await app.close();
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}

/** `data` of a success envelope. */
export const data = <T>(res: { body: unknown }): T =>
  (res.body as { data: T }).data;

/** The error envelope. */
export const error = (res: {
  body: unknown;
}): { code?: string; [key: string]: unknown } => res.body as { code?: string };
