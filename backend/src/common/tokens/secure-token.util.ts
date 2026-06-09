import { createHash, randomBytes } from 'crypto';

/**
 * Generate a cryptographically-random, single-use token (64-char hex). The raw
 * value is sent to the user; only its hash is ever persisted.
 */
export const generateToken = (): string => randomBytes(32).toString('hex');

/**
 * Hash a raw token for storage / lookup. Tokens are short-lived, high-entropy
 * and single-use, so a fast SHA-256 digest is sufficient (no salt needed —
 * lookups must be deterministic).
 */
export const hashToken = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex');
