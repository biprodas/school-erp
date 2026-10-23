import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import type { CurriculumTemplate } from './curriculum-template';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const PRIMARY = [
  'English',
  'Mathematics',
  'Science',
  'Global Perspectives',
  'Computing',
  'Art and Design',
  'Physical Education',
  'Bangla',
];

/**
 * Cambridge pathway for English-medium schools: Primary (Year 1–6), Lower
 * Secondary (Year 7–9) and IGCSE/O Level (Year 10–11, syllabus codes) with
 * Science and Commerce groups.
 */
export const CAMBRIDGE_TEMPLATE: CurriculumTemplate = {
  code: 'cambridge',
  name: 'Cambridge (Year 1–11, IGCSE/O Level)',
  description:
    'Cambridge Primary and Lower Secondary subjects, then IGCSE/O Level with Science and Commerce groups for Year 10–11.',
  suggestedFor: [OrganizationType.ENGLISH_MEDIUM],
  subjects: [
    { name: 'English' },
    { name: 'Mathematics' },
    { name: 'Science' },
    { name: 'Global Perspectives' },
    { name: 'Computing' },
    { name: 'Art and Design' },
    { name: 'Physical Education' },
    { name: 'Bangla' },
    { name: 'First Language English', code: '0500' },
    { name: 'English as a Second Language', code: '0510' },
    { name: 'IGCSE Mathematics', code: '0580' },
    { name: 'Additional Mathematics', code: '0606' },
    { name: 'Physics', code: '0625' },
    { name: 'Chemistry', code: '0620' },
    { name: 'Biology', code: '0610' },
    { name: 'Computer Science', code: '0478' },
    { name: 'Economics', code: '0455' },
    { name: 'Business Studies', code: '0450' },
    { name: 'Accounting', code: '0452' },
    { name: 'Bangladesh Studies', code: '7094' },
    { name: 'Bengali', code: '3204' },
  ],
  groups: [
    {
      name: 'Science',
      subjects: [
        { name: 'Physics', compulsory: true },
        { name: 'Chemistry', compulsory: true },
        { name: 'Biology', compulsory: true },
        { name: 'Additional Mathematics', compulsory: false },
      ],
    },
    {
      name: 'Commerce',
      subjects: [
        { name: 'Economics', compulsory: true },
        { name: 'Business Studies', compulsory: true },
        { name: 'Accounting', compulsory: true },
      ],
    },
  ],
  classes: [
    ...range(1, 9).map((n) => ({
      name: `Year ${n}`,
      level: n,
      compulsory: PRIMARY,
    })),
    ...range(10, 11).map((n) => ({
      name: `Year ${n}`,
      level: n,
      compulsory: ['IGCSE Mathematics', 'Bangladesh Studies', 'Bengali'],
      optional: [
        'First Language English',
        'English as a Second Language',
        'Computer Science',
      ],
      groups: ['Science', 'Commerce'],
    })),
  ],
};
