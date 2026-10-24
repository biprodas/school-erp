import { round } from './math';
import type { ComponentMark, SubjectInput } from './types';

/** One exam's marks for a subject, with the exam's weight in the result. */
export interface WeightedSubject {
  weight: number;
  subject: SubjectInput;
}

/**
 * Combines a subject across the exams of a result (PRD 6.9 "combined
 * results"): each component's mark is scaled to the heaviest exam's full
 * marks and averaged by weight over the exams that had it. The combined
 * subject is then graded like any other.
 */
export function combineSubject(parts: WeightedSubject[]): SubjectInput {
  if (!parts.length) throw new Error('combineSubject needs at least one exam');
  const reference = [...parts].sort((a, b) => b.weight - a.weight)[0].subject;
  if (parts.length === 1) return reference;

  const codes = [
    ...new Set(parts.flatMap((p) => p.subject.components.map((c) => c.code))),
  ];
  const fullOf = (code: string) =>
    reference.components.find((c) => c.code === code) ??
    parts.flatMap((p) => p.subject.components).find((c) => c.code === code)!;

  const components: ComponentMark[] = codes.map((code) => {
    const ref = fullOf(code);
    const taken = parts
      .map((p) => ({
        w: p.weight,
        c: p.subject.components.find((x) => x.code === code),
      }))
      .filter(
        (x): x is { w: number; c: ComponentMark } => !!x.c && !x.c.exempt,
      );
    if (!taken.length) {
      return { ...ref, value: null, absent: false, exempt: true };
    }
    const weight = taken.reduce((n, x) => n + x.w, 0);
    const share = taken.reduce(
      (n, x) => n + (x.w * (x.c.absent ? 0 : (x.c.value ?? 0))) / x.c.fullMarks,
      0,
    );
    return {
      code,
      fullMarks: ref.fullMarks,
      passMarks: ref.passMarks,
      value: round((share / weight) * ref.fullMarks),
      absent: taken.every((x) => x.c.absent),
      exempt: false,
    };
  });

  return {
    ...reference,
    fullMarks: components.reduce((n, c) => n + c.fullMarks, 0),
    components,
  };
}

/** Combines every subject of several exams (each a list of subjects). */
export function combineExams(
  exams: { weight: number; subjects: SubjectInput[] }[],
): SubjectInput[] {
  const byId = new Map<string, WeightedSubject[]>();
  for (const exam of exams) {
    for (const subject of exam.subjects) {
      const list = byId.get(subject.id) ?? [];
      list.push({ weight: exam.weight, subject });
      byId.set(subject.id, list);
    }
  }
  return [...byId.values()].map(combineSubject);
}
