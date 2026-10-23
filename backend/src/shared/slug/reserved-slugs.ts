import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * School slugs (doc/domains-and-routing.md, section 2). The slug is the
 * school's subdomain, so it follows DNS label rules plus our own: 3–40
 * characters of `a-z`, `0-9` and `-`, starting and ending with a letter or
 * digit. The frontend reads the reserved list from `GET /public/slugs/reserved`.
 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/** Hosts and paths of our own that a school can never take. */
export const RESERVED_SLUGS: readonly string[] = [
  'www',
  'api',
  'app',
  'admin',
  'platform',
  'dashboard',
  'auth',
  'login',
  'signup',
  'account',
  'mail',
  'smtp',
  'email',
  'status',
  'docs',
  'help',
  'support',
  'blog',
  'static',
  'assets',
  'cdn',
  'media',
  'files',
  'billing',
  'pay',
  'payments',
  'dev',
  'staging',
  'test',
  'demo',
  'schools',
];

const RESERVED = new Set(RESERVED_SLUGS);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * A slug candidate from free text: `Dhaka Ideal School & College` →
 * `dhaka-ideal-school-college`. May still be reserved or too short; callers
 * check with `isValidSlug`/`isReservedSlug`.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
}

/**
 * Alternatives to offer when `base` is taken or reserved, best first:
 * `acme-school`, `acme-bd`, `acme-2`, `acme-3`, … All are valid slugs.
 */
export function slugCandidates(base: string, count = 12): string[] {
  const root = slugify(base)
    .slice(0, SLUG_MAX_LENGTH - 7)
    .replace(/-+$/, '');
  if (!root) return [];
  const out: string[] = [];
  const push = (s: string) => {
    if (isValidSlug(s) && !isReservedSlug(s) && !out.includes(s)) out.push(s);
  };
  push(root);
  push(`${root}-school`);
  push(`${root}-bd`);
  for (let n = 2; out.length < count && n < count + 2; n++) {
    push(`${root}-${n}`);
  }
  return out;
}

/** `@IsSlug()`: a valid, non-reserved school slug. */
export function IsSlug(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isSlug',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message:
          'The address must be 3–40 lower-case letters, digits or hyphens, start and end with a letter or digit, and not be reserved',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          isValidSlug(value) &&
          !isReservedSlug(value),
      },
    });
  };
}
