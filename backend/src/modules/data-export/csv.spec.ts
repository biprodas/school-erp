import { csvField, csvRow } from './csv';

describe('csv', () => {
  it('quotes only when needed and escapes quotes', () => {
    expect(csvRow(['a', 1, null, true])).toBe('a,1,,true\r\n');
    expect(csvField('Rahim, Uddin')).toBe('"Rahim, Uddin"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvField(new Date('2026-10-24T00:00:00Z'))).toBe(
      '2026-10-24T00:00:00.000Z',
    );
  });
});
