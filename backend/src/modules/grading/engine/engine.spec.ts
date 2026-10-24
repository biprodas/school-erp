import {
  ALIA_MADRASA_TEMPLATE,
  BD_GPA_5_TEMPLATE,
  CAMBRIDGE_TEMPLATE,
  GPA_4_TEMPLATE,
  PERCENTAGE_DIVISION_TEMPLATE,
  type GradingTemplate,
} from '~/shared/templates/grading';
import { combineExams } from './combine';
import { gradeResult } from './grade-result';
import { gradeSubject } from './grade-subject';
import { rank } from './positions';
import type { ComponentMark, GradingScheme, SubjectInput } from './types';

const scheme = (
  t: GradingTemplate,
  rules: Partial<GradingScheme['rules']> = {},
): GradingScheme => ({
  kind: t.kind,
  bands: t.bands,
  rules: { ...t.rules, ...rules },
});

/** A one-component subject out of `full`. */
const sub = (
  id: string,
  value: number | null,
  opts: Partial<SubjectInput> & {
    full?: number;
    absent?: boolean;
    exempt?: boolean;
  } = {},
): SubjectInput => {
  const full = opts.full ?? 100;
  return {
    id,
    fullMarks: full,
    passMarks: opts.passMarks ?? null,
    isFourth: opts.isFourth,
    compulsory: opts.compulsory ?? !opts.isFourth,
    components: opts.components ?? [
      {
        code: 'written',
        fullMarks: full,
        passMarks: null,
        value,
        absent: opts.absent,
        exempt: opts.exempt,
      },
    ],
  };
};

/** CQ 70 (pass 23) + MCQ 30 (pass 10), the BD board split. */
const cqMcq = (
  id: string,
  cq: number,
  mcq: number,
  extra: Partial<SubjectInput> = {},
) =>
  sub(id, null, {
    ...extra,
    components: [
      { code: 'cq', fullMarks: 70, passMarks: 23, value: cq },
      { code: 'mcq', fullMarks: 30, passMarks: 10, value: mcq },
    ] satisfies ComponentMark[],
  });

describe('[gpa-regression] grading engine', () => {
  describe('BD GPA 5.0', () => {
    const bd = scheme(BD_GPA_5_TEMPLATE);

    it.each([
      [100, 'A+', 5],
      [80, 'A+', 5],
      [79, 'A', 4],
      [70, 'A', 4],
      [69, 'A-', 3.5],
      [60, 'A-', 3.5],
      [59, 'B', 3],
      [50, 'B', 3],
      [49, 'C', 2],
      [40, 'C', 2],
      [39, 'D', 1],
      [33, 'D', 1],
      [32, 'F', 0],
      [0, 'F', 0],
    ])('grades %d marks as %s (%d)', (marks, letter, point) => {
      expect(gradeSubject(sub('x', marks), bd)).toMatchObject({
        letter,
        point,
      });
    });

    it('rounds fractional marks up before grading (32.5 passes)', () => {
      expect(gradeSubject(sub('x', 32.5), bd)).toMatchObject({
        marks: 33,
        letter: 'D',
        passed: true,
      });
      expect(gradeSubject(sub('x', 79.5), bd).letter).toBe('A+');
    });

    it('grades out of other full marks by percentage', () => {
      expect(gradeSubject(sub('x', 40, { full: 50 }), bd).letter).toBe('A+');
      expect(gradeSubject(sub('x', 16, { full: 50 }), bd).letter).toBe('F');
    });

    it('needs each component’s own pass mark', () => {
      const r = gradeSubject(cqMcq('phy', 60, 8), bd);
      expect(r.marks).toBe(68);
      expect(r).toMatchObject({
        passed: false,
        letter: 'F',
        point: 0,
        failedComponents: ['mcq'],
      });
      expect(gradeSubject(cqMcq('phy', 23, 10), bd)).toMatchObject({
        marks: 33,
        letter: 'D',
        passed: true,
      });
    });

    it('averages points over the subjects, two decimals', () => {
      const r = gradeResult(
        [
          sub('ban', 85),
          sub('eng', 72),
          sub('math', 75),
          sub('sci', 65),
          sub('soc', 55),
          sub('rel', 90),
        ],
        bd,
      );
      // (5 + 4 + 4 + 3.5 + 3 + 5) / 6 = 4.0833
      expect(r).toMatchObject({ gpa: 4.08, grade: 'A', passed: true });
    });

    it('adds the 4th subject’s points above 2.0', () => {
      const six = [
        sub('ban', 85),
        sub('eng', 72),
        sub('math', 75),
        sub('sci', 65),
        sub('soc', 55),
        sub('rel', 90),
      ];
      // 4th subject A (4.0): bonus 2.0 → 26.5 / 6 = 4.4167
      const a = gradeResult([...six, sub('agri', 72, { isFourth: true })], bd);
      expect(a).toMatchObject({
        gpa: 4.42,
        gpaWithoutFourth: 4.08,
        grade: 'A',
      });
      // C (2.0) and D (1.0) add nothing and take nothing away.
      expect(
        gradeResult([...six, sub('agri', 45, { isFourth: true })], bd).gpa,
      ).toBe(4.08);
      expect(
        gradeResult([...six, sub('agri', 35, { isFourth: true })], bd).gpa,
      ).toBe(4.08);
    });

    it('caps GPA at 5.00', () => {
      const r = gradeResult(
        [
          sub('a', 90),
          sub('b', 90),
          sub('c', 90),
          sub('d', 90),
          sub('e', 90),
          sub('f', 90),
          sub('g', 95, { isFourth: true }),
        ],
        bd,
      );
      expect(r).toMatchObject({ gpa: 5, grade: 'A+' });
    });

    it('fails the result on an F in any compulsory subject', () => {
      const r = gradeResult(
        [sub('a', 95), sub('b', 95), sub('c', 30), sub('d', 95)],
        bd,
      );
      expect(r).toMatchObject({
        passed: false,
        gpa: 0,
        grade: 'F',
        failedCount: 1,
      });
    });

    it('does not fail the result on an F in the 4th subject', () => {
      const r = gradeResult(
        [sub('a', 80), sub('b', 70), sub('c', 20, { isFourth: true })],
        bd,
      );
      expect(r).toMatchObject({ passed: true, gpa: 4.5, failedCount: 0 });
    });

    it('fails a subject absent in every component', () => {
      const r = gradeResult(
        [sub('a', 90), sub('b', null, { absent: true })],
        bd,
      );
      expect(r.subjects[1]).toMatchObject({
        absent: true,
        passed: false,
        letter: 'F',
      });
      expect(r.passed).toBe(false);
    });

    it('leaves exempt subjects out of totals and GPA', () => {
      const r = gradeResult(
        [sub('a', 90), sub('b', 70), sub('pe', null, { exempt: true })],
        bd,
      );
      expect(r.subjects[2]).toMatchObject({ exempt: true, letter: null });
      expect(r).toMatchObject({ gpa: 4.5, total: 160, fullMarks: 200 });
    });

    describe('grace marks', () => {
      const graced = scheme(BD_GPA_5_TEMPLATE, {
        grace: { perSubject: 5, total: 6 },
      });

      it('adds just enough to pass', () => {
        const r = gradeResult([sub('a', 30), sub('b', 60)], graced);
        expect(r.subjects[0]).toMatchObject({
          marks: 33,
          rawMarks: 30,
          grace: 3,
          letter: 'D',
          passed: true,
        });
        expect(r).toMatchObject({ passed: true, graceUsed: 3 });
      });

      it('gives none above the per-subject limit', () => {
        const r = gradeResult([sub('a', 27)], graced);
        expect(r.subjects[0]).toMatchObject({ grace: 0, passed: false });
      });

      it('spends the total on the smallest needs first', () => {
        const r = gradeResult(
          [sub('a', 29), sub('b', 31), sub('c', 30)],
          graced,
        );
        // Needs 4, 2, 3: b and c get theirs (5), a doesn't fit in what's left.
        expect(r.subjects.map((s) => s.grace)).toEqual([0, 2, 3]);
        expect(r.passed).toBe(false);
      });

      it('lifts a failed component to its pass mark', () => {
        const r = gradeResult([cqMcq('phy', 50, 8)], graced);
        expect(r.subjects[0]).toMatchObject({
          grace: 2,
          passed: true,
          marks: 60,
        });
        expect(r.subjects[0].components[1]).toMatchObject({
          value: 10,
          passed: true,
        });
      });

      it('never helps an absent subject', () => {
        const r = gradeResult([sub('a', null, { absent: true })], graced);
        expect(r.subjects[0].grace).toBe(0);
      });
    });

    it('combines exams by weight, then grades (30% half-yearly + 70% annual)', () => {
      const [math] = combineExams([
        { weight: 30, subjects: [sub('math', 40, { full: 50 })] },
        { weight: 70, subjects: [sub('math', 60)] },
      ]);
      // 0.3 × 80% + 0.7 × 60% = 66% of the annual's 100.
      expect(math.fullMarks).toBe(100);
      expect(gradeSubject(math, bd)).toMatchObject({ marks: 66, letter: 'A-' });
    });

    it('combines per component and keeps component pass marks', () => {
      const [phy] = combineExams([
        { weight: 50, subjects: [cqMcq('phy', 60, 6)] },
        { weight: 50, subjects: [cqMcq('phy', 60, 8)] },
      ]);
      const r = gradeSubject(phy, bd);
      expect(r.components.map((c) => c.value)).toEqual([60, 7]);
      expect(r).toMatchObject({ passed: false, failedComponents: ['mcq'] });
    });
  });

  describe('GPA 4.0', () => {
    const g4 = scheme(GPA_4_TEMPLATE);

    it('uses the UGC bands and has no 4th-subject bonus', () => {
      expect(gradeSubject(sub('x', 85), g4)).toMatchObject({
        letter: 'A+',
        point: 4,
      });
      expect(gradeSubject(sub('x', 72), g4)).toMatchObject({
        letter: 'A-',
        point: 3.5,
      });
      expect(gradeSubject(sub('x', 39.5), g4)).toMatchObject({
        letter: 'F',
        passed: false,
      });
      const r = gradeResult(
        [sub('a', 85), sub('b', 72), sub('c', 62, { isFourth: true })],
        g4,
      );
      // The 4th-subject rule is off: all three count. (4 + 3.5 + 3) / 3
      expect(r).toMatchObject({ gpa: 3.5, grade: 'A-' });
    });
  });

  describe('Cambridge A*–U', () => {
    const cam = scheme(CAMBRIDGE_TEMPLATE);

    it('gives letters by percentage and U fails', () => {
      expect(gradeSubject(sub('x', 92), cam).letter).toBe('A*');
      expect(gradeSubject(sub('x', 65), cam).letter).toBe('C');
      expect(gradeSubject(sub('x', 21), cam).letter).toBe('G');
      expect(gradeSubject(sub('x', 15), cam)).toMatchObject({
        letter: 'U',
        passed: false,
      });
    });

    it('grades the result by overall percentage', () => {
      const r = gradeResult([sub('a', 92), sub('b', 78), sub('c', 85)], cam);
      expect(r).toMatchObject({ percentage: 85, grade: 'A', passed: true });
      expect(gradeResult([sub('a', 92), sub('b', 10)], cam)).toMatchObject({
        passed: false,
        grade: 'U',
      });
    });
  });

  describe('percentage and division', () => {
    const pct = scheme(PERCENTAGE_DIVISION_TEMPLATE);

    it.each([
      [[70, 65, 50], 'First Division', 61.67],
      [[50, 45, 42], 'Second Division', 45.67],
      [[35, 40, 33], 'Third Division', 36],
    ])('places %j in the %s', (marks, division, percentage) => {
      const r = gradeResult(
        marks.map((m, i) => sub(`s${i}`, m)),
        pct,
      );
      expect(r).toMatchObject({
        grade: division,
        percentage,
        gpa: null,
        passed: true,
      });
    });

    it('fails on any subject below 33%', () => {
      const r = gradeResult([sub('a', 90), sub('b', 30)], pct);
      expect(r).toMatchObject({ grade: 'Fail', passed: false, failedCount: 1 });
    });
  });

  describe('Alia madrasa', () => {
    const mad = scheme(ALIA_MADRASA_TEMPLATE);

    it('grades a Dakhil result like the board, 4th subject included', () => {
      const r = gradeResult(
        [
          sub('quran', 88),
          sub('hadith', 76),
          sub('arabic1', 81),
          sub('arabic2', 64),
          sub('bangla', 58),
          sub('english', 71),
          sub('math', 82),
          sub('agri', 80, { isFourth: true }),
        ],
        mad,
      );
      // (5 + 4 + 5 + 3.5 + 3 + 4 + 5 + (5 − 2)) / 7 = 4.6429
      expect(r).toMatchObject({ gpa: 4.64, grade: 'A', passed: true });
    });
  });

  describe('positions', () => {
    const row = (
      id: string,
      gpa: number,
      total: number,
      roll: string,
      passed = true,
    ) => ({
      id,
      passed,
      failedCount: passed ? 0 : 1,
      gpa,
      total,
      percentage: total / 6,
      compulsoryTotal: total,
      roll,
    });

    it('ranks by GPA, then total, then roll; failed students last', () => {
      const positions = rank([
        row('a', 4.5, 500, '3'),
        row('b', 5, 520, '2'),
        row('c', 4.5, 510, '1'),
        row('d', 0, 400, '4', false),
        row('e', 4.5, 500, '5'),
      ]);
      expect(Object.fromEntries(positions)).toEqual({
        b: 1,
        c: 2,
        a: 3,
        e: 4,
        d: 5,
      });
    });

    it('shares a position on a full tie and skips the next', () => {
      const positions = rank(
        [row('a', 5, 500, '1'), row('b', 5, 500, '2'), row('c', 4, 480, '3')],
        ['gpa', 'total'],
      );
      expect(Object.fromEntries(positions)).toEqual({ a: 1, b: 1, c: 3 });
    });
  });
});
