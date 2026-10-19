import { randomBytes } from 'node:crypto';
import {
  decryptField,
  EncryptedColumn,
  encryptField,
  fieldKeyring,
  needsReencryption,
} from './field-encryption';

const newKey = (id: string) => `${id}:${randomBytes(32).toString('base64')}`;

describe('field encryption', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = newKey('k1');
    delete process.env.FIELD_ENCRYPTION_OLD_KEYS;
    fieldKeyring.reset();
  });

  afterAll(() => {
    process.env = saved;
    fieldKeyring.reset();
  });

  it('round-trips text, including Bangla', () => {
    const nid = '১৯৯০২৬৯১২৩৪৫৬৭৮৯';
    const stored = encryptField(nid);

    expect(stored).toMatch(/^v1:k1:/);
    expect(stored).not.toContain(nid);
    expect(decryptField(stored)).toBe(nid);
  });

  it('uses a fresh IV, so equal values are stored differently', () => {
    expect(encryptField('same')).not.toBe(encryptField('same'));
  });

  it('detects tampering', () => {
    const parts = encryptField('secret').split(':');
    parts[4] = Buffer.from('forged').toString('base64');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it('still decrypts values written with a rotated-out key', () => {
    const stored = encryptField('old value');
    process.env.FIELD_ENCRYPTION_OLD_KEYS = process.env.FIELD_ENCRYPTION_KEY;
    process.env.FIELD_ENCRYPTION_KEY = newKey('k2');
    fieldKeyring.reset();

    expect(decryptField(stored)).toBe('old value');
    expect(needsReencryption(stored)).toBe(true);
    expect(encryptField('new')).toMatch(/^v1:k2:/);
  });

  it('fails clearly for an unknown key id', () => {
    const stored = encryptField('x');
    process.env.FIELD_ENCRYPTION_KEY = newKey('k9');
    fieldKeyring.reset();
    expect(() => decryptField(stored)).toThrow(
      /Unknown field encryption key "k1"/,
    );
  });

  it('passes null and undefined through the column transformer', () => {
    expect(EncryptedColumn.to(null)).toBeNull();
    expect(EncryptedColumn.to(undefined)).toBeUndefined();
    expect(EncryptedColumn.from(null)).toBeNull();
    expect(EncryptedColumn.from(EncryptedColumn.to('abc'))).toBe('abc');
  });
});
