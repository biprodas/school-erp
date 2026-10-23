import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import type { CurriculumTemplate } from './curriculum-template';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const EBTEDAYEE_EARLY = [
  'Quran Majeed and Tajweed',
  'Arabic',
  'Aqaid and Fiqh',
  'Bangla',
  'English',
  'Mathematics',
];
const EBTEDAYEE_LATE = [
  ...EBTEDAYEE_EARLY,
  'Bangladesh and Global Studies',
  'Elementary Science',
];
const DAKHIL_CORE = [
  'Quran Majeed and Tajweed',
  'Hadith Sharif',
  'Aqaid and Fiqh',
  'Arabic 1st Paper',
  'Arabic 2nd Paper',
  'Bangla 1st Paper',
  'Bangla 2nd Paper',
  'English 1st Paper',
  'English 2nd Paper',
  'Mathematics',
  'Information and Communication Technology',
];

/**
 * Alia madrasa (Bangladesh Madrasah Education Board): Ebtedayee (Class 1–5)
 * and Dakhil (Class 6–10), with Science and General groups for 9–10.
 */
export const ALIA_MADRASA_TEMPLATE: CurriculumTemplate = {
  code: 'alia-madrasa',
  name: 'Alia madrasa (Ebtedayee and Dakhil)',
  description:
    'Madrasah board subjects for Ebtedayee (Class 1–5) and Dakhil (Class 6–10), with Science and General groups for Class 9–10.',
  suggestedFor: [OrganizationType.MADRASA],
  subjects: [
    { name: 'Quran Majeed and Tajweed' },
    { name: 'Arabic' },
    { name: 'Aqaid and Fiqh' },
    { name: 'Hadith Sharif' },
    { name: 'Arabic 1st Paper' },
    { name: 'Arabic 2nd Paper' },
    { name: 'Bangla' },
    { name: 'English' },
    { name: 'Bangla 1st Paper' },
    { name: 'Bangla 2nd Paper' },
    { name: 'English 1st Paper' },
    { name: 'English 2nd Paper' },
    { name: 'Mathematics' },
    { name: 'Bangladesh and Global Studies' },
    { name: 'Elementary Science' },
    { name: 'Science' },
    { name: 'Information and Communication Technology' },
    { name: 'Physical Education and Health' },
    { name: 'Physics' },
    { name: 'Chemistry' },
    { name: 'Biology' },
    { name: 'Higher Mathematics' },
    { name: 'Islamic History' },
    { name: 'General Science' },
  ],
  groups: [
    {
      name: 'Science',
      subjects: [
        { name: 'Physics', compulsory: true },
        { name: 'Chemistry', compulsory: true },
        { name: 'Biology', compulsory: false },
        { name: 'Higher Mathematics', compulsory: false },
      ],
    },
    {
      name: 'General',
      subjects: [
        { name: 'Islamic History', compulsory: true },
        { name: 'Bangladesh and Global Studies', compulsory: true },
        { name: 'General Science', compulsory: true },
      ],
    },
  ],
  classes: [
    ...range(1, 2).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: EBTEDAYEE_EARLY,
    })),
    ...range(3, 5).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: EBTEDAYEE_LATE,
    })),
    ...range(6, 8).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: [
        ...DAKHIL_CORE,
        'Science',
        'Bangladesh and Global Studies',
        'Physical Education and Health',
      ],
    })),
    ...range(9, 10).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: DAKHIL_CORE,
      groups: ['Science', 'General'],
    })),
  ],
};
