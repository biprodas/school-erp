import { NOTIFICATION_EVENTS, OrgSettingsValues } from './settings.types';

const channels = (sms = false) => ({ inApp: true, email: true, sms });

/**
 * What a school starts with. `org_settings` stores only what the school
 * changed, and reads merge that over these.
 */
export const DEFAULT_SETTINGS: OrgSettingsValues = {
  profile: {
    nameBn: null,
    address: {
      line1: null,
      line2: null,
      area: null,
      district: null,
      postCode: null,
    },
    phone: null,
    email: null,
    website: null,
    establishedYear: null,
    principalName: null,
    principalSignatureFileId: null,
    colors: { primary: null, secondary: null },
    letterhead: {
      showLogo: true,
      showAddress: true,
      showContact: true,
      showEiin: true,
      tagline: null,
      footerText: null,
    },
  },
  locale: {
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    numerals: 'en',
    currency: 'BDT',
    timeZone: 'Asia/Dhaka',
    weekStart: 'saturday',
    weekendDays: ['friday'],
  },
  numbering: {
    studentId: '{YY}{CLASS}{SEQ:4}',
    employeeId: 'EMP-{SEQ:4}',
    roll: '{SEQ}',
    receipt: 'RCP-{YYYY}-{SEQ:6}',
    invoice: 'INV-{YYYY}{MM}-{SEQ:5}',
    certificate: 'CERT-{YYYY}-{SEQ:4}',
    voucher: 'EXP-{YYYY}-{SEQ:5}',
    allowManualStudentId: false,
  },
  portal: {
    studentAccounts: true,
    studentMinLevel: 6,
    studentClassIds: [],
  },
  results: {
    verifyStep: false,
    tieBreakers: ['gpa', 'total', 'roll'],
    reportCard: {
      language: 'en',
      showPosition: true,
      showAttendance: true,
      showRemarks: true,
      signatures: ['Class teacher', 'Guardian', 'Head teacher'],
    },
  },
  attendance: { mode: 'day', lockAfterDays: 7, cutoffTime: null },
  fees: {
    billingDay: 1,
    dueDay: 10,
    graceDays: 10,
    reminderDays: [3, 15],
    blockResultsOnDues: false,
  },
  notifications: {
    events: Object.fromEntries(
      NOTIFICATION_EVENTS.map((event) => [event, channels()]),
    ) as OrgSettingsValues['notifications']['events'],
    smsSenderId: null,
  },
  security: { sessionIdleMinutes: null },
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `patch` over `base`: plain objects merge key by key, anything else
 * (arrays, scalars, null) replaces. `undefined` keeps the base value, and so
 * does anything that isn't a plain object where `base` has one (a nested
 * object is never replaced by an array, scalar or null). Keys not in `base`
 * are dropped, so a stale stored field never resurfaces. The result never
 * shares objects with `base` (the defaults stay untouched).
 */
export function mergeSettings<T>(base: T, patch: unknown): T {
  if (patch === undefined) return structuredClone(base);
  if (isPlainObject(base) && !isPlainObject(patch)) {
    return structuredClone(base);
  }
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return structuredClone(patch) as T;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    out[key] = mergeSettings(base[key], key in patch ? patch[key] : undefined);
  }
  return out as T;
}

/**
 * A validated section patch over what the school stored before (its
 * overrides, not the full section): nested objects merge, other values
 * replace, `undefined` leaves the stored value (or its absence) alone, and
 * `null` is stored, since for a nullable field it means "cleared" rather
 * than "default". Keys the defaults don't know are dropped. Only what the
 * school changed is kept, so later changes to the defaults still reach it.
 */
export function mergeOverrides(
  shape: unknown,
  stored: unknown,
  patch: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = isPlainObject(stored)
    ? structuredClone(stored)
    : {};
  if (!isPlainObject(shape) || !isPlainObject(patch)) return out;
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value === undefined || !(key in shape)) continue;
    if (isPlainObject(shape[key])) {
      // Nested objects only ever merge (see `mergeSettings`).
      if (!isPlainObject(value)) continue;
      out[key] = mergeOverrides(shape[key], out[key], value);
    } else {
      out[key] = structuredClone(value);
    }
  }
  return out;
}

/** Stored sections (null = never saved) completed with the defaults. */
export function withDefaults(
  stored: Partial<Record<keyof OrgSettingsValues, unknown>>,
): OrgSettingsValues {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(
    DEFAULT_SETTINGS,
  ) as (keyof OrgSettingsValues)[]) {
    out[key] = mergeSettings(DEFAULT_SETTINGS[key], stored[key] ?? undefined);
  }
  return out as unknown as OrgSettingsValues;
}
