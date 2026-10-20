import * as bcrypt from 'bcrypt';

const BCRYPT_COST = 10;

/** Hashes a password for the global account (`users.password`). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}
