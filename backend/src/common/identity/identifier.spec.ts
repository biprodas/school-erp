import { normalizeEmail, normalizePhone, parseIdentifier } from './identifier';

describe('normalizePhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['+880 1712-345678', '+8801712345678'],
    ['(017) 1234 5678', '+8801712345678'],
    ['01312345678', '+8801312345678'],
  ])('normalizes Bangladesh mobile %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('keeps international E.164 numbers', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it.each(['01212345678', '0171234567', '12345', '+0123456789', 'abc'])(
    'rejects %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe('parseIdentifier', () => {
  it('treats anything with @ as an email and lowercases it', () => {
    expect(parseIdentifier('  Rahim@School.EDU.bd ')).toEqual({
      email: 'rahim@school.edu.bd',
    });
  });

  it('parses phone numbers', () => {
    expect(parseIdentifier('01712-345678')).toEqual({
      phone: '+8801712345678',
    });
  });

  it('rejects malformed input', () => {
    expect(parseIdentifier('not-an-email@')).toBeNull();
    expect(parseIdentifier('12')).toBeNull();
    expect(parseIdentifier('   ')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail(' A@B.Com ')).toBe('a@b.com');
  });
});
