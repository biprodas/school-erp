/** What merit ties are broken by, in order (PRD 6.9). */
export type TieBreaker =
  'gpa' | 'total' | 'percentage' | 'compulsoryTotal' | 'roll';

export const TIE_BREAKERS: readonly TieBreaker[] = [
  'gpa',
  'total',
  'percentage',
  'compulsoryTotal',
  'roll',
];

export interface RankRow {
  id: string;
  passed: boolean;
  failedCount: number;
  gpa: number | null;
  total: number;
  percentage: number;
  compulsoryTotal: number;
  roll: string | null;
}

/** Numeric rolls compare as numbers, then text, then missing ones last. */
function compareRoll(a: string | null, b: string | null): number {
  const na = Number(a);
  const nb = Number(b);
  if (a && b && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return (a ?? '￿').localeCompare(b ?? '￿');
}

function compare(a: RankRow, b: RankRow, keys: readonly TieBreaker[]) {
  if (a.passed !== b.passed) return a.passed ? -1 : 1;
  if (!a.passed && a.failedCount !== b.failedCount) {
    return a.failedCount - b.failedCount;
  }
  for (const key of keys) {
    const diff =
      key === 'roll'
        ? compareRoll(a.roll, b.roll)
        : (b[key] ?? -1) - (a[key] ?? -1);
    if (diff) return diff;
  }
  return 0;
}

/**
 * Merit positions: passed students first, then failed ones by fewest failed
 * subjects; within each, by the tie-breakers in order. Students equal on
 * every key share a position and the next is skipped (1, 1, 3).
 */
export function rank(
  rows: RankRow[],
  tieBreakers: readonly TieBreaker[] = ['gpa', 'total', 'roll'],
): Map<string, number> {
  const sorted = [...rows].sort((a, b) => compare(a, b, tieBreakers));
  const positions = new Map<string, number>();
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    positions.set(
      row.id,
      prev && compare(prev, row, tieBreakers) === 0
        ? positions.get(prev.id)!
        : i + 1,
    );
  });
  return positions;
}
