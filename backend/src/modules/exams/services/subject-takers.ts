import type { ClassSubject } from '~/modules/class-curriculum/entities/class-subject.entity';
import { ClassSubjectType } from '~/modules/class-curriculum/enums/class-subject-type.enum';

/**
 * Whether an enrollment sits a class subject, and as its 4th subject:
 * compulsory subjects are for everyone (in their group, when the subject
 * belongs to one); optional, 4th and elective ones only for students who
 * chose them (`student_subjects`).
 */
export function takesSubject(
  enrollment: { subjectGroupId: string | null },
  subject: Pick<ClassSubject, 'subjectId' | 'subjectType' | 'subjectGroupId'>,
  choices: Map<string, boolean> | undefined,
): { takes: boolean; isFourth: boolean } {
  const isFourth = choices?.get(subject.subjectId) === true;
  if (
    subject.subjectGroupId &&
    subject.subjectGroupId !== enrollment.subjectGroupId
  ) {
    return { takes: false, isFourth: false };
  }
  if (subject.subjectType === ClassSubjectType.COMPULSORY) {
    return { takes: true, isFourth };
  }
  return { takes: !!choices?.has(subject.subjectId), isFourth };
}
