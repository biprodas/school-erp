import type { TieBreaker } from '~/modules/grading/engine/positions';

/**
 * The school's settings (PRD 6.24), one typed section each. Stored per
 * section in `org_settings`; a missing section or field reads as its default
 * (`settings.defaults.ts`), so new fields need no data migration.
 */

export type Weekday =
  | 'saturday'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday';

export const WEEKDAYS: readonly Weekday[] = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

export const DATE_FORMATS = [
  'DD/MM/YYYY',
  'DD-MM-YYYY',
  'YYYY-MM-DD',
  'D MMM YYYY',
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export interface ProfileSettings {
  /** The school's name in Bangla (the English name is `organizations.name`). */
  nameBn: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    area: string | null;
    district: string | null;
    postCode: string | null;
  };
  phone: string | null;
  email: string | null;
  website: string | null;
  establishedYear: number | null;
  principalName: string | null;
  /** Uploaded through `POST /settings/files/signature`. */
  principalSignatureFileId: string | null;
  /** Brand colors as `#rrggbb`. */
  colors: { primary: string | null; secondary: string | null };
  /** What the letterhead on every PDF shows. */
  letterhead: {
    showLogo: boolean;
    showAddress: boolean;
    showContact: boolean;
    showEiin: boolean;
    tagline: string | null;
    footerText: string | null;
  };
}

export interface LocaleSettings {
  language: 'bn' | 'en';
  dateFormat: DateFormat;
  numerals: 'bn' | 'en';
  /** ISO 4217; money is stored in minor units of it. */
  currency: string;
  /** IANA zone; business dates (attendance day, due date) use it. */
  timeZone: string;
  weekStart: Weekday;
  weekendDays: Weekday[];
}

export interface NumberingSettings {
  studentId: string;
  /** Staff directory numbers, when not typed in (M2). */
  employeeId: string;
  roll: string;
  receipt: string;
  invoice: string;
  certificate: string;
  /** Lets staff type a student ID instead of generating it (M3). */
  allowManualStudentId: boolean;
}

export interface PortalSettings {
  /** Whether any student gets a portal login (guardians always do). */
  studentAccounts: boolean;
  /** Classes with `level >= studentMinLevel` qualify... */
  studentMinLevel: number;
  /** ...unless this list is non-empty, which then decides alone. */
  studentClassIds: string[];
}

export interface ReportCardSettings {
  language: 'bn' | 'en';
  showPosition: boolean;
  /** The session's attendance so far (days and percentage). */
  showAttendance: boolean;
  showRemarks: boolean;
  /** Signature lines at the bottom, left to right. */
  signatures: string[];
}

export interface ResultsSettings {
  /** Mark sheets need the Verified step between Submitted and Approved. */
  verifyStep: boolean;
  /** Merit ties are broken by these, in order (after pass/fail). */
  tieBreakers: TieBreaker[];
  reportCard: ReportCardSettings;
}

export interface AttendanceSettings {
  mode: 'day' | 'period';
  /** Records older than this many days need `attendance:edit_locked`. */
  lockAfterDays: number;
  /** Local `HH:mm` by which a day's register is due; null = no cutoff. */
  cutoffTime: string | null;
}

export interface FeesSettings {
  /** Day of the month monthly invoices are generated (1–28). */
  billingDay: number;
  /** Days after the due date before late fines apply. */
  graceDays: number;
  /** Hide published results on the portal while fees are due. */
  blockResultsOnDues: boolean;
}

export const NOTIFICATION_EVENTS = [
  'absent',
  'feeDue',
  'paymentReceived',
  'resultPublished',
  'noticePublished',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface ChannelPreferences {
  inApp: boolean;
  email: boolean;
  /** Sent from Phase 1b (SMS wallet). */
  sms: boolean;
}

export interface NotificationSettings {
  events: Record<NotificationEvent, ChannelPreferences>;
  /** Masked SMS sender ID (Phase 1b). */
  smsSenderId: string | null;
}

export interface SecuritySettings {
  /** Sign-ins unused this long can't be refreshed; null = no idle limit. */
  sessionIdleMinutes: number | null;
}

export interface OrgSettingsValues {
  profile: ProfileSettings;
  locale: LocaleSettings;
  numbering: NumberingSettings;
  portal: PortalSettings;
  results: ResultsSettings;
  attendance: AttendanceSettings;
  fees: FeesSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
}

export type SettingsSection = keyof OrgSettingsValues;

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  'profile',
  'locale',
  'numbering',
  'portal',
  'results',
  'attendance',
  'fees',
  'notifications',
  'security',
];
