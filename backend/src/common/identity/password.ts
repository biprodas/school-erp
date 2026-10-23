import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const BCRYPT_COST = 10;

/** Hashes a password for the global account (`users.password`). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

let unusable: Promise<string> | undefined;

/**
 * A bcrypt hash of a random secret that is never stored or shown, for
 * accounts that have no password yet (invited, imported guardians): no
 * input matches it. Computed once per process, so bulk imports don't pay
 * one bcrypt round per account. Such accounts also get
 * `password_set = false`, so activation lets the owner choose one.
 */
export function unusablePasswordHash(): Promise<string> {
  unusable ??= hashPassword(randomBytes(32).toString('base64url'));
  return unusable;
}
