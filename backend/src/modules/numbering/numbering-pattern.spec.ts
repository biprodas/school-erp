import {
  patternScope,
  assertValidPattern,
  formatNumber,
} from './numbering-pattern';

const date = new Date(2026, 0, 15);

describe('formatNumber', () => {
  it('renders the student ID default pattern', () => {
    expect(
      formatNumber('{YY}{CLASS}{SEQ:4}', 42, { date, classCode: '06' }),
    ).toBe('26060042');
  });

  it('supports year, month and literal text', () => {
    expect(formatNumber('RCP-{YYYY}{MM}-{SEQ:6}', 7, { date })).toBe(
      'RCP-202601-000007',
    );
  });

  it('does not truncate sequences longer than the pad width', () => {
    expect(formatNumber('{SEQ:2}', 12345, { date })).toBe('12345');
  });

  it('accepts bigint sequences', () => {
    expect(formatNumber('{SEQ}', 9007199254740993n, { date })).toBe(
      '9007199254740993',
    );
  });

  it('requires a class code for {CLASS}', () => {
    expect(() => formatNumber('{CLASS}{SEQ}', 1, { date })).toThrow(
      /class code/,
    );
  });
});

describe('assertValidPattern', () => {
  it('requires exactly one {SEQ}', () => {
    expect(() => assertValidPattern('{YY}{CLASS}')).toThrow();
    expect(() => assertValidPattern('{SEQ}{SEQ:2}')).toThrow();
    expect(() => assertValidPattern('{YY}-{SEQ:4}')).not.toThrow();
  });
});

describe('patternScope', () => {
  it('renders everything but the sequence', () => {
    const date = new Date('2026-03-01T00:00:00Z');
    expect(patternScope('{YY}{CLASS}{SEQ:4}', { date, classCode: '06' })).toBe(
      '2606',
    );
    expect(patternScope('EMP-{SEQ:4}')).toBe('EMP-');
  });
});
