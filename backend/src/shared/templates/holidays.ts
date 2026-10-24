/**
 * Bangladesh government holidays (PRD 6.7), applied per year from
 * onboarding. Only the fixed-date ones are written: the religious holidays
 * follow the lunar calendars, so their dates are announced each year and
 * the school adds them by hand (the apply step lists them).
 *
 * Written from the government holiday lists; review before the pilot.
 */
export type HolidayTemplateType = 'public' | 'school' | 'religious';

export interface FixedHolidayTemplate {
  name: string;
  nameBn: string;
  type: HolidayTemplateType;
  /** 1–12. */
  month: number;
  day: number;
}

export interface MovableHolidayTemplate {
  name: string;
  nameBn: string;
  type: HolidayTemplateType;
}

export const BD_FIXED_HOLIDAYS: FixedHolidayTemplate[] = [
  {
    name: 'Shaheed Day and International Mother Language Day',
    nameBn: 'শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস',
    type: 'public',
    month: 2,
    day: 21,
  },
  {
    name: 'Independence and National Day',
    nameBn: 'স্বাধীনতা ও জাতীয় দিবস',
    type: 'public',
    month: 3,
    day: 26,
  },
  {
    name: 'Bangla New Year',
    nameBn: 'বাংলা নববর্ষ',
    type: 'public',
    month: 4,
    day: 14,
  },
  { name: 'May Day', nameBn: 'মে দিবস', type: 'public', month: 5, day: 1 },
  {
    name: 'Victory Day',
    nameBn: 'বিজয় দিবস',
    type: 'public',
    month: 12,
    day: 16,
  },
  {
    name: 'Christmas Day',
    nameBn: 'যিশুখ্রিস্টের জন্মদিন (বড়দিন)',
    type: 'religious',
    month: 12,
    day: 25,
  },
];

/** Dates set each year by the moon; the school adds them once announced. */
export const BD_MOVABLE_HOLIDAYS: MovableHolidayTemplate[] = [
  { name: 'Shab-e-Barat', nameBn: 'শবে বরাত', type: 'religious' },
  { name: 'Shab-e-Qadr', nameBn: 'শবে কদর', type: 'religious' },
  { name: 'Jumatul Bidah', nameBn: 'জুমাতুল বিদা', type: 'religious' },
  { name: 'Eid-ul-Fitr', nameBn: 'ঈদুল ফিতর', type: 'religious' },
  { name: 'Eid-ul-Azha', nameBn: 'ঈদুল আজহা', type: 'religious' },
  { name: 'Ashura', nameBn: 'আশুরা', type: 'religious' },
  { name: 'Eid-e-Miladunnabi', nameBn: 'ঈদে মিলাদুন্নবী', type: 'religious' },
  { name: 'Buddha Purnima', nameBn: 'বুদ্ধ পূর্ণিমা', type: 'religious' },
  { name: 'Janmashtami', nameBn: 'জন্মাষ্টমী', type: 'religious' },
  {
    name: 'Durga Puja (Bijoya Dashami)',
    nameBn: 'দুর্গাপূজা (বিজয়া দশমী)',
    type: 'religious',
  },
];
