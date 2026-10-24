import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectErrorCodes, renderErrorCodes } from './error-codes';

describe('error code reference', () => {
  const root = join(__dirname, '..', '..');
  const doc = join(root, '..', '..', 'doc', 'error-codes.md');

  it('finds the codes thrown across the modules', () => {
    const codes = collectErrorCodes(root).map((e) => e.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'ATTENDANCE_LOCKED',
        'RESULTS_NOT_CURRENT',
        'PAYMENT_EXCEEDS_DUE',
      ]),
    );
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('is up to date in doc/error-codes.md (run npm run docs:error-codes)', () => {
    expect(existsSync(doc)).toBe(true);
    expect(readFileSync(doc, 'utf8')).toBe(
      renderErrorCodes(collectErrorCodes(root)),
    );
  });
});
