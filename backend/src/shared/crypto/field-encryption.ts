import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

interface FieldKey {
  id: string;
  key: Buffer;
}

function parseKey(spec: string): FieldKey {
  const [id, b64] = spec.split(':');
  const key = Buffer.from(b64 ?? '', 'base64');
  if (!id || key.length !== 32) {
    throw new Error(
      'Field encryption keys must look like `<keyId>:<base64 of 32 bytes>`',
    );
  }
  return { id, key };
}

/**
 * Keys come from the environment (validated at boot by env.validation):
 * `FIELD_ENCRYPTION_KEY` encrypts, it and `FIELD_ENCRYPTION_OLD_KEYS` decrypt.
 * Read lazily because entity decorators are evaluated before config loads.
 */
class FieldKeyring {
  private current?: FieldKey;
  private all?: Map<string, Buffer>;

  private load(): void {
    const spec = process.env.FIELD_ENCRYPTION_KEY;
    if (!spec) {
      throw new Error('FIELD_ENCRYPTION_KEY is not set');
    }
    this.current = parseKey(spec);
    this.all = new Map([[this.current.id, this.current.key]]);
    for (const old of (process.env.FIELD_ENCRYPTION_OLD_KEYS ?? '')
      .split(',')
      .filter(Boolean)) {
      const k = parseKey(old);
      this.all.set(k.id, k.key);
    }
  }

  encryptionKey(): FieldKey {
    if (!this.current) this.load();
    return this.current!;
  }

  decryptionKey(id: string): Buffer {
    if (!this.all) this.load();
    const key = this.all!.get(id);
    if (!key) throw new Error(`Unknown field encryption key "${id}"`);
    return key;
  }

  /** Tests only: forget the cached keys after changing the environment. */
  reset(): void {
    this.current = undefined;
    this.all = undefined;
  }
}

export const fieldKeyring = new FieldKeyring();

/** `v1:<keyId>:<iv>:<tag>:<ciphertext>`, all base64. */
export function encryptField(plain: string): string {
  const { id, key } = fieldKeyring.encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, id, iv, tag, data]
    .map((p) => (Buffer.isBuffer(p) ? p.toString('base64') : p))
    .join(':');
}

export function decryptField(stored: string): string {
  const [version, keyId, iv, tag, data] = stored.split(':');
  if (version !== VERSION || !keyId || !iv || !tag || data === undefined) {
    throw new Error('Malformed encrypted field value');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    fieldKeyring.decryptionKey(keyId),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** True when a stored value was written with an older key. */
export function needsReencryption(stored: string): boolean {
  return stored.split(':')[1] !== fieldKeyring.encryptionKey().id;
}

/**
 * Column transformer for sensitive text (NID, health notes, bank accounts):
 * `@Column({ type: 'text', nullable: true, transformer: EncryptedColumn })`.
 * Each write gets a fresh IV, so equal values don't look equal: never
 * filter, sort or index on these columns.
 */
export const EncryptedColumn: ValueTransformer = {
  to: (value: string | null | undefined) =>
    value === null || value === undefined ? value : encryptField(value),
  from: (value: string | null) => (value === null ? null : decryptField(value)),
};
