import type { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import type { SubjectType } from '~/modules/subjects/enums/subject-type.enum';
import { SubjectComponent } from '~/modules/class-curriculum/enums/subject-component.enum';

/**
 * A class-and-subject template a school applies during onboarding (PRD 6.2
 * step 4). Code-defined: changing one never touches schools that applied
 * it. Applying is idempotent and only adds what is missing (matched by
 * name, subjects also by code).
 */
export interface CurriculumTemplate {
  code: string;
  name: string;
  description: string;
  /** School types it is offered to first (all types may apply it). */
  suggestedFor: OrganizationType[];
  subjects: TemplateSubject[];
  groups: TemplateGroup[];
  classes: TemplateClass[];
}

export interface TemplateSubject {
  name: string;
  /** Board subject code where one exists (e.g. SSC `101`). */
  code?: string;
  type?: SubjectType;
  /**
   * Board exam parts (e.g. SSC CQ 70 + MCQ 30), added to the subject in
   * classes with `boardComponents`. Schools can edit them afterwards.
   */
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  component: SubjectComponent;
  fullMarks: number;
  passMarks: number;
}

/** A board component with the usual 33% pass mark. */
export const boardComponent = (
  component: SubjectComponent,
  fullMarks: number,
): TemplateComponent => ({
  component,
  fullMarks,
  passMarks: Math.round(fullMarks * 0.33),
});

/**
 * A stream such as Science; its subjects by name. In a class that offers
 * the group they become class subjects too (non-compulsory ones as
 * optional), tagged with the group when it is the only one listing them.
 */
export interface TemplateGroup {
  name: string;
  subjects: { name: string; compulsory: boolean }[];
}

export interface TemplateClass {
  name: string;
  level: number;
  /** Subjects every student of the class takes. */
  compulsory: string[];
  /** Choose-one subjects (religion). */
  optional?: string[];
  /** Candidates for the BD 4th subject. */
  fourth?: string[];
  /** Groups offered in the class (9–10). */
  groups?: string[];
  /** Give the class's subjects their template `components`. */
  boardComponents?: boolean;
}

/** Every subject name a template uses must be in its `subjects`. */
export function templateSubjectNames(t: CurriculumTemplate): Set<string> {
  const names = new Set<string>();
  for (const c of t.classes) {
    [...c.compulsory, ...(c.optional ?? []), ...(c.fourth ?? [])].forEach((n) =>
      names.add(n),
    );
  }
  for (const g of t.groups) g.subjects.forEach((s) => names.add(s.name));
  return names;
}
