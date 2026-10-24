import type { GradeBand, GradingRules } from './types';

/** Rounds to `decimals` places, immune to binary noise (2.675 → 2.68). */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function truncate(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.floor((value + 1e-9) * f) / f;
}

export function roundMarks(
  marks: number,
  rule: GradingRules['markRounding'],
): number {
  if (rule === 'up') return Math.ceil(marks - 1e-9);
  if (rule === 'nearest') return Math.round(marks + 1e-9);
  return round(marks);
}

/** Bands from the highest minimum down. */
export const sortBands = (bands: GradeBand[]) =>
  [...bands].sort((a, b) => b.minPercent - a.minPercent);

/** The band a percentage falls in (the lowest band below every minimum). */
export function bandFor(bands: GradeBand[], percentage: number): GradeBand {
  const sorted = sortBands(bands);
  return (
    sorted.find((b) => percentage + 1e-9 >= b.minPercent) ??
    sorted[sorted.length - 1]
  );
}

/** Lowest percentage that is not a fail band. */
export function passPercent(bands: GradeBand[]): number {
  const passing = bands.filter((b) => !b.isFail).map((b) => b.minPercent);
  return passing.length ? Math.min(...passing) : 0;
}

/** The letter for a GPA: the highest passing band whose point it reaches. */
export function letterForGpa(bands: GradeBand[], gpa: number): GradeBand {
  const byPoint = [...bands]
    .filter((b) => !b.isFail)
    .sort((a, b) => b.point - a.point);
  return (
    byPoint.find((b) => gpa + 1e-9 >= b.point) ??
    sortBands(bands)[bands.length - 1]
  );
}
