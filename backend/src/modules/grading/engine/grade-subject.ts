import { bandFor, passPercent, roundMarks, round } from './math';
import type {
  ComponentResult,
  GradingScheme,
  SubjectInput,
  SubjectResult,
} from './types';

/**
 * Grades one subject: component marks → total, percentage, letter, point
 * and pass/fail (subject pass mark, the scale's pass band and, when the
 * rules say so, each component's own pass mark). `grace` marks, if given,
 * are added to reach a pass (see `graceNeeded`).
 */
export function gradeSubject(
  subject: SubjectInput,
  scheme: GradingScheme,
  grace = 0,
): SubjectResult {
  const active = subject.components.filter((c) => !c.exempt);
  const base = {
    id: subject.id,
    isFourth: !!subject.isFourth,
    compulsory: !!subject.compulsory,
  };
  if (!active.length) {
    return {
      ...base,
      marks: 0,
      rawMarks: 0,
      fullMarks: 0,
      percentage: 0,
      letter: null,
      point: null,
      passed: true,
      absent: false,
      exempt: true,
      grace: 0,
      failedComponents: [],
      components: subject.components.map((c) => ({
        code: c.code,
        fullMarks: c.fullMarks,
        value: null,
        absent: false,
        exempt: true,
        passed: true,
      })),
    };
  }

  const absent = active.every((c) => c.absent);
  const fullMarks = active.reduce((n, c) => n + c.fullMarks, 0);
  const rawMarks = round(
    active.reduce((n, c) => n + (c.absent ? 0 : (c.value ?? 0)), 0),
  );
  const graceByComponent = spreadGrace(subject, scheme, grace);
  const components: ComponentResult[] = subject.components.map((c) => {
    if (c.exempt) {
      return {
        code: c.code,
        fullMarks: c.fullMarks,
        value: null,
        absent: false,
        exempt: true,
        passed: true,
      };
    }
    const value = c.absent
      ? null
      : (c.value ?? 0) + (graceByComponent.get(c.code) ?? 0);
    const passed =
      !scheme.rules.componentPass ||
      c.passMarks === null ||
      (!c.absent && value! + 1e-9 >= c.passMarks);
    return {
      code: c.code,
      fullMarks: c.fullMarks,
      value: c.absent ? null : round(value!),
      absent: !!c.absent,
      exempt: false,
      passed,
    };
  });

  const marks = absent
    ? 0
    : roundMarks(rawMarks + grace, scheme.rules.markRounding);
  const percentage = fullMarks ? round((marks / fullMarks) * 100) : 0;
  const band = bandFor(scheme.bands, percentage);
  const passMark = scaledPassMark(subject, fullMarks);
  const failedComponents = components
    .filter((c) => !c.exempt && !c.passed)
    .map((c) => c.code);
  const passed =
    !absent &&
    !band.isFail &&
    (passMark === null || marks + 1e-9 >= passMark) &&
    failedComponents.length === 0;
  const failBand = [...scheme.bands]
    .filter((b) => b.isFail)
    .sort((a, b) => a.minPercent - b.minPercent)[0];
  const shown = passed ? band : (failBand ?? band);

  return {
    ...base,
    marks,
    rawMarks,
    fullMarks,
    percentage,
    letter: shown.letter,
    point: passed ? band.point : (failBand?.point ?? 0),
    passed,
    absent,
    exempt: false,
    grace,
    failedComponents,
    components,
  };
}

/**
 * Marks a failed subject needs to pass: each failing component up to its
 * pass mark, then the total up to the subject pass mark and the scale's
 * pass band. Null when grace can't help (absent, or already passed).
 */
export function graceNeeded(
  subject: SubjectInput,
  scheme: GradingScheme,
): number | null {
  const plain = gradeSubject(subject, scheme);
  if (plain.passed || plain.absent || plain.exempt) return null;
  const active = subject.components.filter((c) => !c.exempt);
  let need = 0;
  for (const c of active) {
    if (!scheme.rules.componentPass || c.passMarks === null) continue;
    if (c.absent) return null;
    need += Math.max(0, c.passMarks - (c.value ?? 0));
  }
  const fullMarks = plain.fullMarks;
  const target = Math.max(
    scaledPassMark(subject, fullMarks) ?? 0,
    (passPercent(scheme.bands) * fullMarks) / 100,
  );
  need += Math.max(0, target - (plain.rawMarks + need));
  // Rounding up already counts fractions as whole marks.
  const marksNeeded = Math.ceil(need - 1e-9);
  return marksNeeded > 0 ? marksNeeded : null;
}

/** The subject's pass mark over the components that aren't exempt. */
function scaledPassMark(subject: SubjectInput, fullMarks: number) {
  if (subject.passMarks === null) return null;
  if (!subject.fullMarks || fullMarks === subject.fullMarks) {
    return subject.passMarks;
  }
  return (subject.passMarks * fullMarks) / subject.fullMarks;
}

/** Grace goes to failing components first (so they pass), the rest to none. */
function spreadGrace(
  subject: SubjectInput,
  scheme: GradingScheme,
  grace: number,
): Map<string, number> {
  const given = new Map<string, number>();
  if (!grace || !scheme.rules.componentPass) return given;
  let left = grace;
  for (const c of subject.components) {
    if (c.exempt || c.absent || c.passMarks === null) continue;
    const short = Math.max(0, c.passMarks - (c.value ?? 0));
    const add = Math.min(short, left);
    if (add > 0) {
      given.set(c.code, add);
      left -= add;
    }
  }
  return given;
}
