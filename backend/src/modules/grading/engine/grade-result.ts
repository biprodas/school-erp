import { gradeSubject, graceNeeded } from './grade-subject';
import { bandFor, letterForGpa, round, truncate } from './math';
import type {
  GradingScheme,
  OverallResult,
  SubjectInput,
  SubjectResult,
} from './types';

/**
 * Grades a student's whole result (PRD 6.9):
 *
 * - Grace marks go to the failed subjects that need the fewest first,
 *   within the per-subject and total limits.
 * - Subjects that count are all but the exempt ones and the 4th subject.
 *   With `failedSubjectFailsResult`, failing one fails the result (GPA 0).
 * - GPA = (points of the counted subjects + the 4th subject's points above
 *   the threshold) / counted subjects, capped and rounded to 2 decimals.
 * - The overall letter comes from the GPA (GPA schemes), the percentage
 *   (letter schemes) or the division (percentage schemes).
 */
export function gradeResult(
  inputs: SubjectInput[],
  scheme: GradingScheme,
): OverallResult {
  const { rules } = scheme;
  const grace = allocateGrace(inputs, scheme);
  const subjects = inputs.map((s) =>
    gradeSubject(s, scheme, grace.get(s.id) ?? 0),
  );

  const fourthOn = rules.fourthSubject.enabled;
  const graded = subjects.filter((s) => !s.exempt);
  const counted = graded.filter((s) => !(fourthOn && s.isFourth));
  const fourth = fourthOn ? graded.find((s) => s.isFourth) : undefined;

  const total = round(graded.reduce((n, s) => n + s.marks, 0));
  const fullMarks = graded.reduce((n, s) => n + s.fullMarks, 0);
  const percentage = fullMarks ? round((total / fullMarks) * 100) : 0;
  const compulsoryTotal = round(
    graded.filter((s) => s.compulsory).reduce((n, s) => n + s.marks, 0),
  );
  const failedCount = counted.filter((s) => !s.passed).length;
  const graceUsed = subjects.reduce((n, s) => n + s.grace, 0);
  let passed = !rules.failedSubjectFailsResult || failedCount === 0;
  if (!counted.length) passed = false;

  const base = {
    subjects,
    total,
    fullMarks,
    percentage,
    compulsoryTotal,
    failedCount,
    graceUsed,
  };

  if (scheme.kind === 'percentage') {
    const division = [...rules.divisions]
      .sort((a, b) => b.minPercent - a.minPercent)
      .find((d) => percentage + 1e-9 >= d.minPercent);
    const ok = passed && !!division;
    return {
      ...base,
      gpa: null,
      gpaWithoutFourth: null,
      grade: ok ? division.name : rules.failGrade,
      passed: ok,
    };
  }

  const fix = rules.gpaRounding === 'truncate' ? truncate : round;
  const points = counted.reduce((n, s) => n + (s.point ?? 0), 0);
  const bonus = fourth
    ? Math.max(0, (fourth.point ?? 0) - rules.fourthSubject.threshold)
    : 0;
  let gpa = counted.length ? (points + bonus) / counted.length : 0;
  if (rules.gpaCap !== null) gpa = Math.min(gpa, rules.gpaCap);
  const gpaWithoutFourth = counted.length ? fix(points / counted.length) : 0;
  if (!passed) {
    return {
      ...base,
      gpa: 0,
      gpaWithoutFourth: 0,
      grade: rules.failGrade,
      passed,
    };
  }
  gpa = fix(gpa);
  const grade =
    scheme.kind === 'gpa'
      ? letterForGpa(scheme.bands, gpa).letter
      : bandFor(scheme.bands, percentage).letter;
  return { ...base, gpa, gpaWithoutFourth, grade, passed };
}

/** Grace per subject id: smallest needs first, within both limits. */
function allocateGrace(
  inputs: SubjectInput[],
  scheme: GradingScheme,
): Map<string, number> {
  const given = new Map<string, number>();
  const limits = scheme.rules.grace;
  if (!limits) return given;
  const needs = inputs
    .map((s, i) => ({ id: s.id, i, need: graceNeeded(s, scheme) }))
    .filter(
      (n): n is { id: string; i: number; need: number } =>
        n.need !== null && n.need <= limits.perSubject,
    )
    .sort((a, b) => a.need - b.need || a.i - b.i);
  let left = limits.total;
  for (const n of needs) {
    if (n.need > left) continue;
    given.set(n.id, n.need);
    left -= n.need;
  }
  return given;
}

export type { SubjectResult };
