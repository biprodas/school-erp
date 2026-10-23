import { ALIA_MADRASA_TEMPLATE } from './curriculum/alia-madrasa';
import { CAMBRIDGE_TEMPLATE } from './curriculum/cambridge';
import type { CurriculumTemplate } from './curriculum/curriculum-template';
import { NCTB_TEMPLATE } from './curriculum/nctb';

export * from './curriculum/curriculum-template';
export * from './grading';
export * from './fee-heads';

/** Curriculum templates by code. */
export const CURRICULUM_TEMPLATES: readonly CurriculumTemplate[] = [
  NCTB_TEMPLATE,
  CAMBRIDGE_TEMPLATE,
  ALIA_MADRASA_TEMPLATE,
];
