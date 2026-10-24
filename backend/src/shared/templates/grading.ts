import type {
  GradeBand,
  GradingKind,
  GradingRules,
} from '~/modules/grading/engine/types';

/**
 * Grading templates (PRD 6.9): a school creates its grading systems from
 * these (`POST /grading-systems/from-template/:code`, or onboarding) and
 * may edit them afterwards. Written from the published rules; the
 * regression suites in `grading/engine` pin their behaviour.
 */
export interface GradingTemplate {
  code: string;
  name: string;
  description: string;
  kind: GradingKind;
  /** Highest grade point (0 for percentage schemes). */
  scale: number;
  bands: GradeBand[];
  rules: GradingRules;
}

const band = (
  letter: string,
  minPercent: number,
  maxPercent: number,
  point: number,
  isFail = false,
): GradeBand => ({ letter, minPercent, maxPercent, point, isFail });

/** BD SSC/HSC bands, also used by the madrasa boards. */
const BD_BANDS: GradeBand[] = [
  band('A+', 80, 100, 5),
  band('A', 70, 79, 4),
  band('A-', 60, 69, 3.5),
  band('B', 50, 59, 3),
  band('C', 40, 49, 2),
  band('D', 33, 39, 1),
  band('F', 0, 32, 0, true),
];

const BD_RULES: GradingRules = {
  markRounding: 'up',
  componentPass: true,
  failedSubjectFailsResult: true,
  fourthSubject: { enabled: true, threshold: 2 },
  gpaCap: 5,
  gpaRounding: 'round',
  grace: null,
  divisions: [],
  failGrade: 'F',
};

/** Bangladesh SSC/HSC GPA 5.0 (the default, PRD 6.2 step 5). */
export const BD_GPA_5_TEMPLATE: GradingTemplate = {
  code: 'bd-gpa-5',
  name: 'Bangladesh GPA 5.0',
  description:
    'SSC/HSC scale: 4th-subject points above 2.0 added, GPA capped at 5.00, F in any other subject fails.',
  kind: 'gpa',
  scale: 5,
  bands: BD_BANDS,
  rules: BD_RULES,
};

/** The UGC uniform grading scale (GPA 4.0). */
export const GPA_4_TEMPLATE: GradingTemplate = {
  code: 'gpa-4',
  name: 'GPA 4.0',
  description: 'UGC uniform grading: A+ 80% = 4.00 down to D 40% = 2.00.',
  kind: 'gpa',
  scale: 4,
  bands: [
    band('A+', 80, 100, 4),
    band('A', 75, 79, 3.75),
    band('A-', 70, 74, 3.5),
    band('B+', 65, 69, 3.25),
    band('B', 60, 64, 3),
    band('B-', 55, 59, 2.75),
    band('C+', 50, 54, 2.5),
    band('C', 45, 49, 2.25),
    band('D', 40, 44, 2),
    band('F', 0, 39, 0, true),
  ],
  rules: {
    ...BD_RULES,
    markRounding: 'none',
    componentPass: false,
    fourthSubject: { enabled: false, threshold: 0 },
    gpaCap: 4,
  },
};

/** Cambridge IGCSE A*–G, U ungraded. */
export const CAMBRIDGE_TEMPLATE: GradingTemplate = {
  code: 'cambridge',
  name: 'Cambridge (A*–U)',
  description:
    'IGCSE letters by percentage; points (A* = 8 … G = 1) only rank students.',
  kind: 'letter',
  scale: 8,
  bands: [
    band('A*', 90, 100, 8),
    band('A', 80, 89, 7),
    band('B', 70, 79, 6),
    band('C', 60, 69, 5),
    band('D', 50, 59, 4),
    band('E', 40, 49, 3),
    band('F', 30, 39, 2),
    band('G', 20, 29, 1),
    band('U', 0, 19, 0, true),
  ],
  rules: {
    ...BD_RULES,
    markRounding: 'none',
    componentPass: false,
    fourthSubject: { enabled: false, threshold: 0 },
    gpaCap: null,
    failGrade: 'U',
  },
};

/** Percentage with divisions (pass 33% per subject). */
export const PERCENTAGE_DIVISION_TEMPLATE: GradingTemplate = {
  code: 'percentage-division',
  name: 'Percentage and division',
  description:
    '33% passes a subject; First division 60%, Second 45%, Third 33% overall.',
  kind: 'percentage',
  scale: 0,
  bands: [band('Pass', 33, 100, 0), band('Fail', 0, 32, 0, true)],
  rules: {
    ...BD_RULES,
    markRounding: 'none',
    componentPass: false,
    fourthSubject: { enabled: false, threshold: 0 },
    gpaCap: null,
    divisions: [
      { name: 'First Division', minPercent: 60 },
      { name: 'Second Division', minPercent: 45 },
      { name: 'Third Division', minPercent: 33 },
    ],
    failGrade: 'Fail',
  },
};

/** Alia madrasa (Dakhil/Alim): the board GPA 5.0 rules. */
export const ALIA_MADRASA_TEMPLATE: GradingTemplate = {
  code: 'alia-madrasa',
  name: 'Alia madrasa (Dakhil/Alim)',
  description:
    'Bangladesh Madrasah Education Board: the GPA 5.0 scale with the 4th-subject bonus.',
  kind: 'gpa',
  scale: 5,
  bands: BD_BANDS,
  rules: BD_RULES,
};

export const GRADING_TEMPLATES: GradingTemplate[] = [
  BD_GPA_5_TEMPLATE,
  GPA_4_TEMPLATE,
  CAMBRIDGE_TEMPLATE,
  PERCENTAGE_DIVISION_TEMPLATE,
  ALIA_MADRASA_TEMPLATE,
];
