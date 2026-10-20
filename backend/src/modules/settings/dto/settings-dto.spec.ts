import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateLocaleSettingsDto } from './update-locale-settings.dto';
import { UpdateNotificationSettingsDto } from './update-notification-settings.dto';
import { UpdateNumberingSettingsDto } from './update-numbering-settings.dto';
import { UpdateProfileSettingsDto } from './update-profile-settings.dto';
import {
  UpdateAttendanceSettingsDto,
  UpdateFeesSettingsDto,
  UpdateSecuritySettingsDto,
} from './update-workflow-settings.dto';

/** Validates like the global ValidationPipe (see `app.setup.ts`). */
async function errors(cls: new () => object, body: object) {
  const result = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
    skipUndefinedProperties: true,
  });
  const paths = (list: typeof result, prefix = ''): string[] =>
    list.flatMap((e) => [
      ...(e.constraints ? [`${prefix}${e.property}`] : []),
      ...paths(e.children ?? [], `${prefix}${e.property}.`),
    ]);
  return paths(result).sort();
}

describe('settings DTOs', () => {
  it('accepts an empty patch', async () => {
    expect(await errors(UpdateLocaleSettingsDto, {})).toEqual([]);
  });

  it('checks locale values', async () => {
    expect(
      await errors(UpdateLocaleSettingsDto, {
        language: 'bn',
        timeZone: 'Asia/Dhaka',
        currency: 'BDT',
        weekendDays: ['friday', 'saturday'],
      }),
    ).toEqual([]);
    expect(
      await errors(UpdateLocaleSettingsDto, {
        language: 'fr',
        timeZone: 'Mars/Olympus',
        currency: 'TAKA',
        weekendDays: ['friday', 'friday'],
      }),
    ).toEqual(['currency', 'language', 'timeZone', 'weekendDays']);
  });

  it('refuses null for a field that has no "unset" state', async () => {
    expect(await errors(UpdateLocaleSettingsDto, { language: null })).toEqual([
      'language',
    ]);
  });

  it('allows null to clear a nullable field', async () => {
    expect(
      await errors(UpdateProfileSettingsDto, { phone: null, nameBn: null }),
    ).toEqual([]);
  });

  it('validates nested profile objects and rejects unknown keys', async () => {
    expect(
      await errors(UpdateProfileSettingsDto, {
        colors: { primary: 'red' },
        letterhead: { showLogo: 'yes', watermark: true },
      }),
    ).toEqual([
      'colors.primary',
      'letterhead.showLogo',
      'letterhead.watermark',
    ]);
  });

  it('refuses arrays and null where a nested object belongs', async () => {
    expect(
      await errors(UpdateProfileSettingsDto, {
        address: [],
        colors: [{ primary: '#123456' }],
        letterhead: null,
      }),
    ).toEqual(['address', 'colors', 'letterhead']);
    expect(await errors(UpdateNotificationSettingsDto, { events: [] })).toEqual(
      ['events'],
    );
    expect(
      await errors(UpdateNotificationSettingsDto, { events: { absent: [{}] } }),
    ).toEqual(['events.absent']);
  });

  it('requires exactly one {SEQ} in numbering patterns', async () => {
    expect(
      await errors(UpdateNumberingSettingsDto, { receipt: 'R-{YYYY}-{SEQ:6}' }),
    ).toEqual([]);
    expect(
      await errors(UpdateNumberingSettingsDto, {
        receipt: 'R-{YYYY}',
        invoice: '{SEQ}-{SEQ}',
      }),
    ).toEqual(['invoice', 'receipt']);
  });

  it('bounds attendance, fees and security values', async () => {
    expect(
      await errors(UpdateAttendanceSettingsDto, {
        cutoffTime: '25:00',
        lockAfterDays: -1,
      }),
    ).toEqual(['cutoffTime', 'lockAfterDays']);
    expect(await errors(UpdateFeesSettingsDto, { billingDay: 31 })).toEqual([
      'billingDay',
    ]);
    expect(
      await errors(UpdateSecuritySettingsDto, { sessionIdleMinutes: 5 }),
    ).toEqual(['sessionIdleMinutes']);
    expect(
      await errors(UpdateSecuritySettingsDto, { sessionIdleMinutes: null }),
    ).toEqual([]);
  });

  it('validates per-event channel preferences', async () => {
    expect(
      await errors(UpdateNotificationSettingsDto, {
        events: { absent: { sms: true }, feeDue: { email: 'no' } },
        smsSenderId: 'ACME SCHOOL',
      }),
    ).toEqual(['events.feeDue.email']);
  });
});
