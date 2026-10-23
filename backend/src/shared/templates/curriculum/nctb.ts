import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import type { CurriculumTemplate } from './curriculum-template';

const RELIGIONS = [
  'Islam and Moral Education',
  'Hindu Religion and Moral Education',
  'Buddhist Religion and Moral Education',
  'Christian Religion and Moral Education',
];

const PRIMARY_EARLY = ['Bangla', 'English', 'Mathematics'];
const PRIMARY_LATE = [
  ...PRIMARY_EARLY,
  'Bangladesh and Global Studies',
  'Elementary Science',
];
const JUNIOR = [
  'Bangla 1st Paper',
  'Bangla 2nd Paper',
  'English 1st Paper',
  'English 2nd Paper',
  'Mathematics',
  'Science',
  'Bangladesh and Global Studies',
  'Information and Communication Technology',
  'Physical Education and Health',
  'Work and Life Oriented Education',
  'Arts and Crafts',
];
const SECONDARY = [
  'Bangla 1st Paper',
  'Bangla 2nd Paper',
  'English 1st Paper',
  'English 2nd Paper',
  'Mathematics',
  'Information and Communication Technology',
  'Physical Education, Health and Sports',
  'Career Education',
];
const FOURTH_SUBJECTS = [
  'Higher Mathematics',
  'Biology',
  'Agriculture Studies',
  'Home Science',
];

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * NCTB national curriculum, Class 1–10 (subject codes from the SSC
 * syllabus). Groups for Class 9–10: Science, Business Studies, Humanities.
 */
export const NCTB_TEMPLATE: CurriculumTemplate = {
  code: 'nctb',
  name: 'NCTB national curriculum (Class 1–10)',
  description:
    'Bangla-version national curriculum: primary, junior and secondary subjects, with Science, Business Studies and Humanities groups for Class 9–10.',
  suggestedFor: [OrganizationType.SCHOOL, OrganizationType.COLLEGE],
  subjects: [
    { name: 'Bangla' },
    { name: 'English' },
    { name: 'Mathematics', code: '109' },
    { name: 'Bangladesh and Global Studies', code: '150' },
    { name: 'Elementary Science' },
    { name: 'Islam and Moral Education', code: '111' },
    { name: 'Hindu Religion and Moral Education', code: '112' },
    { name: 'Buddhist Religion and Moral Education', code: '113' },
    { name: 'Christian Religion and Moral Education', code: '114' },
    { name: 'Bangla 1st Paper', code: '101' },
    { name: 'Bangla 2nd Paper', code: '102' },
    { name: 'English 1st Paper', code: '107' },
    { name: 'English 2nd Paper', code: '108' },
    { name: 'Science' },
    { name: 'Information and Communication Technology', code: '154' },
    { name: 'Physical Education and Health' },
    { name: 'Work and Life Oriented Education' },
    { name: 'Arts and Crafts' },
    { name: 'Physical Education, Health and Sports', code: '147' },
    { name: 'Career Education', code: '156' },
    { name: 'Physics', code: '136' },
    { name: 'Chemistry', code: '137' },
    { name: 'Biology', code: '138' },
    { name: 'Higher Mathematics', code: '126' },
    { name: 'Accounting', code: '146' },
    { name: 'Finance and Banking', code: '152' },
    { name: 'Business Entrepreneurship', code: '143' },
    { name: 'General Science', code: '127' },
    { name: 'History of Bangladesh and World Civilization', code: '153' },
    { name: 'Geography and Environment', code: '110' },
    { name: 'Civics and Citizenship', code: '140' },
    { name: 'Economics', code: '141' },
    { name: 'Agriculture Studies', code: '134' },
    { name: 'Home Science', code: '151' },
  ],
  groups: [
    {
      name: 'Science',
      subjects: [
        { name: 'Physics', compulsory: true },
        { name: 'Chemistry', compulsory: true },
        { name: 'Biology', compulsory: false },
        { name: 'Higher Mathematics', compulsory: false },
        { name: 'Bangladesh and Global Studies', compulsory: true },
      ],
    },
    {
      name: 'Business Studies',
      subjects: [
        { name: 'Accounting', compulsory: true },
        { name: 'Finance and Banking', compulsory: true },
        { name: 'Business Entrepreneurship', compulsory: true },
        { name: 'General Science', compulsory: true },
      ],
    },
    {
      name: 'Humanities',
      subjects: [
        {
          name: 'History of Bangladesh and World Civilization',
          compulsory: true,
        },
        { name: 'Geography and Environment', compulsory: true },
        { name: 'Civics and Citizenship', compulsory: true },
        { name: 'Economics', compulsory: false },
        { name: 'General Science', compulsory: true },
      ],
    },
  ],
  classes: [
    ...range(1, 2).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: PRIMARY_EARLY,
    })),
    ...range(3, 5).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: PRIMARY_LATE,
      optional: RELIGIONS,
    })),
    ...range(6, 8).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: JUNIOR,
      optional: [...RELIGIONS, 'Agriculture Studies', 'Home Science'],
    })),
    ...range(9, 10).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: SECONDARY,
      optional: [...RELIGIONS, ...FOURTH_SUBJECTS],
      groups: ['Science', 'Business Studies', 'Humanities'],
    })),
  ],
};
