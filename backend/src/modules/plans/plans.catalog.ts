/**
 * Plan modules and the four plans of PRD 3.3. A module key names a feature
 * area a plan unlocks; endpoints gate on it with `@RequireModule(key)`.
 * Only modules that exist (or are about to) are listed; later milestones add
 * theirs here and to the plans that include them.
 */
export const PLAN_MODULES = {
  SIS: 'sis',
  ATTENDANCE: 'attendance',
  NOTICES: 'notices',
  RESULTS: 'results',
  FEES: 'fees',
  REPORT_CARDS: 'report_cards',
  PORTAL: 'portal',
  SMS: 'sms',
  HR: 'hr',
  TIMETABLE: 'timetable',
  LMS: 'lms',
  LIBRARY: 'library',
  CUSTOM_ROLES: 'custom_roles',
  CUSTOM_DOMAIN: 'custom_domain',
  TRANSPORT: 'transport',
  HOSTEL: 'hostel',
  INVENTORY: 'inventory',
  MULTI_BRANCH: 'multi_branch',
  ANALYTICS: 'analytics',
  API: 'api',
  AI: 'ai',
} as const;

export type PlanModule = (typeof PLAN_MODULES)[keyof typeof PLAN_MODULES];

export const ALL_PLAN_MODULES = Object.values(PLAN_MODULES) as PlanModule[];

/** Modules a school on a lower plan may buy separately (PRD 3.3). */
export const ADD_ON_MODULES: readonly PlanModule[] = [
  PLAN_MODULES.TRANSPORT,
  PLAN_MODULES.HOSTEL,
  PLAN_MODULES.LMS,
  PLAN_MODULES.AI,
];

/** Plan limits; `null` means unlimited. */
export interface PlanLimits {
  students: number | null;
  storageMb: number | null;
  users: number | null;
  admins: number | null;
}

export type PlanLimitKey = keyof PlanLimits;

export const PLAN_LIMIT_KEYS: readonly PlanLimitKey[] = [
  'students',
  'storageMb',
  'users',
  'admins',
];

export enum PlanCode {
  FREE = 'free',
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

/** The plan a trial grants (PRD 3.3: 30 days of Standard). */
export const TRIAL_PLAN = PlanCode.STANDARD;
export const TRIAL_DAYS = 30;

export interface PlanSeed {
  code: PlanCode;
  name: string;
  /** Per active student per month, in minor units (poisha). */
  pricePerStudent: number;
  /** Minimum monthly fee, in minor units. */
  minFee: number;
  modules: PlanModule[];
  limits: PlanLimits;
  sortOrder: number;
}

const M = PLAN_MODULES;

const FREE_MODULES: PlanModule[] = [M.SIS, M.ATTENDANCE, M.NOTICES, M.RESULTS];
const BASIC_MODULES: PlanModule[] = [
  ...FREE_MODULES,
  M.FEES,
  M.REPORT_CARDS,
  M.PORTAL,
  M.SMS,
];
const STANDARD_MODULES: PlanModule[] = [
  ...BASIC_MODULES,
  M.HR,
  M.TIMETABLE,
  M.LMS,
  M.LIBRARY,
  M.CUSTOM_ROLES,
  M.CUSTOM_DOMAIN,
];

/**
 * Defaults inserted when missing (`PlanSeeder`, and the migration that
 * creates `plans`). Prices are placeholders until sales sets them; an
 * existing row is never overwritten, so edits made in the database stay.
 */
export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: PlanCode.FREE,
    name: 'Free',
    pricePerStudent: 0,
    minFee: 0,
    modules: FREE_MODULES,
    limits: { students: 100, storageMb: 500, users: null, admins: 1 },
    sortOrder: 1,
  },
  {
    code: PlanCode.BASIC,
    name: 'Basic',
    pricePerStudent: 1500,
    minFee: 100000,
    modules: BASIC_MODULES,
    limits: { students: null, storageMb: 5120, users: null, admins: 3 },
    sortOrder: 2,
  },
  {
    code: PlanCode.STANDARD,
    name: 'Standard',
    pricePerStudent: 2500,
    minFee: 200000,
    modules: STANDARD_MODULES,
    limits: { students: null, storageMb: 20480, users: null, admins: null },
    sortOrder: 3,
  },
  {
    code: PlanCode.PREMIUM,
    name: 'Premium',
    pricePerStudent: 4000,
    minFee: 500000,
    modules: [...ALL_PLAN_MODULES],
    limits: { students: null, storageMb: 102400, users: null, admins: null },
    sortOrder: 4,
  },
];
