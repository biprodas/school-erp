import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import type { MailerService } from '@nestjs-modules/mailer';
import type { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { AppI18nModule } from '~/shared/locale/i18n.module';
import { LOCALES, type Locale } from '~/shared/locale/locales';
import { MailService } from './mail.service';

describe('MailService', () => {
  let i18n: I18nService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppI18nModule],
    }).compile();
    i18n = moduleRef.get(I18nService);
  });

  /** Runs `fn` as inside a request whose resolved language is `lang`. */
  const inRequest = <T>(lang: Locale, fn: () => Promise<T>) =>
    I18nContext.createAsync(
      new I18nContext(lang, i18n, undefined as never),
      fn,
    );

  const templates = join(__dirname, 'templates');
  const render = (template: string, context: object) =>
    Handlebars.compile(
      readFileSync(join(templates, `${template}.hbs`), 'utf8'),
      { strict: true },
    )(context);

  let sent: { to: string; subject: string; html: string }[];

  const service = () => {
    const mailer = {
      sendMail: jest.fn(
        (mail: {
          to: string;
          subject: string;
          template: string;
          context: object;
        }) => {
          sent.push({
            to: mail.to,
            subject: mail.subject,
            html: render(mail.template, mail.context),
          });
          return Promise.resolve({ messageId: 'm-1' });
        },
      ),
    };
    const config = {
      get: () => ({ appUrl: 'http://localhost:3000', rootDomain: 'lvh.me' }),
    };
    return new MailService(
      mailer as unknown as MailerService,
      config as unknown as ConfigService,
      i18n,
    );
  };

  beforeEach(() => {
    sent = [];
  });

  it('writes in English when nothing says otherwise', async () => {
    await service().sendPasswordResetEmail('a@x.test', 'Rina', 'tok', 'acme');
    expect(sent[0].subject).toBe('Reset your password');
    expect(sent[0].html).toContain("<html lang='en'>");
    expect(sent[0].html).toContain(
      // Handlebars encodes `=` in attributes; browsers decode it.
      'http://acme.lvh.me:3000/reset-password?token&#x3D;tok',
    );
    // Only one language: no Bangla left in an English email.
    expect(sent[0].html).not.toMatch(/[ঀ-৿]/);
  });

  it("follows the request's language", async () => {
    await inRequest('hi', () =>
      service().sendPasswordResetEmail('a@x.test', 'Rina', 'tok'),
    );
    expect(sent[0].subject).toBe('अपना पासवर्ड रीसेट करें');
    expect(sent[0].html).toContain("<html lang='hi'>");
    expect(sent[0].html).toContain('पासवर्ड रीसेट करें');
    expect(sent[0].html).not.toContain('Reset your password');
  });

  it("lets the caller's locale win over the request's", async () => {
    await inRequest('hi', () =>
      service().sendActivationEmail('a@x.test', 'Rina', 'tok', 'acme', 'bn'),
    );
    expect(sent[0].subject).toBe('অ্যাকাউন্ট চালু করুন');
    expect(sent[0].html).toContain("<html lang='bn'>");
  });

  it.each(LOCALES)('renders every account email in %s', async (locale) => {
    const mail = service();
    await mail.sendActivationEmail('a@x.test', 'R', 't', 'acme', locale);
    await mail.sendWelcomeEmail('a@x.test', 'R', locale);
    await mail.sendEmailVerificationEmail(
      'a@x.test',
      'R',
      't',
      undefined,
      locale,
    );
    await mail.sendPasswordResetEmail('a@x.test', 'R', 't', undefined, locale);
    await mail.sendSignupVerificationEmail(
      'a@x.test',
      {
        name: 'R',
        schoolName: 'Acme',
        schoolHost: 'acme.lvh.me',
        link: 'http://l',
      },
      locale,
    );
    await mail.sendFindSchoolEmail(
      'a@x.test',
      {
        name: 'R',
        schools: [{ name: 'Acme', host: 'acme.lvh.me', link: 'http://l' }],
      },
      locale,
    );
    await mail.sendDataExportReady('a@x.test', 'R', 'http://l', locale);
    expect(sent).toHaveLength(7);
    for (const { html } of sent) {
      expect(html).toContain(`<html lang='${locale}'>`);
      expect(html).not.toMatch(/\{\w+\}/);
    }
  });

  it('escapes variables but keeps the text markup', async () => {
    await service().sendSignupVerificationEmail('a@x.test', {
      name: '<b>R</b>',
      schoolName: 'A & B',
      schoolHost: 'ab.lvh.me',
      link: 'http://l',
    });
    expect(sent[0].subject).toBe('Confirm your signup for A & B');
    expect(sent[0].html).toContain('Hi &lt;b&gt;R&lt;/b&gt;,');
    expect(sent[0].html).toContain('<strong>A &amp; B</strong>');
  });

  it("translates the notification email's button", async () => {
    await service().deliverNotification('a@x.test', 'सूचना: x', 'body', {
      link: 'http://l',
      schoolName: 'Acme',
      locale: 'hi',
    });
    expect(sent[0].html).toContain('>खोलें</a>');
    expect(sent[0].html).toContain("<html lang='hi'>");
  });
});
