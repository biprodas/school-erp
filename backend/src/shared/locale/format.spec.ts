import { formatMoney, formatNumber, groupLakh, toBanglaDigits } from './format';

describe('locale formatting', () => {
  it('groups by lakh and crore', () => {
    expect(groupLakh('1')).toBe('1');
    expect(groupLakh('999')).toBe('999');
    expect(groupLakh('1000')).toBe('1,000');
    expect(groupLakh('100000')).toBe('1,00,000');
    expect(groupLakh('12345678')).toBe('1,23,45,678');
    expect(groupLakh('-1234567')).toBe('-12,34,567');
  });

  it('formats minor units as BDT, in Bangla digits when asked', () => {
    expect(formatMoney(123_456_750)).toBe('12,34,567.50');
    expect(formatMoney(5)).toBe('0.05');
    expect(formatMoney(-150_000, { currency: 'BDT' })).toBe('-1,500.00 BDT');
    expect(formatMoney(123_456_750, { numerals: 'bn' })).toBe('১২,৩৪,৫৬৭.৫০');
    expect(formatMoney(123_456_750, { grouping: 'thousand' })).toBe(
      '1,234,567.50',
    );
  });

  it('writes numbers in the school’s numerals', () => {
    expect(toBanglaDigits('GPA 4.83')).toBe('GPA ৪.৮৩');
    expect(formatNumber(80, 'bn')).toBe('৮০');
    expect(formatNumber(null, 'bn')).toBe('');
  });
});
