import { registerAs } from '@nestjs/config';

const mailerConfig = registerAs('mailer', () => ({
  host: process.env.MAIL_HOST ?? 'localhost',
  port: parseInt(process.env.MAIL_PORT ?? '1025', 10),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER ?? '',
  pass: process.env.MAIL_PASS ?? '',
  fromName: process.env.MAIL_FROM_NAME ?? 'School ERP',
  fromAddress: process.env.MAIL_FROM_ADDRESS ?? 'no-reply@school-erp.local',
  // Base URL of the frontend, used to build activation / reset links.
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
}));

export type MailerConfig = ReturnType<typeof mailerConfig>;
export default mailerConfig;
