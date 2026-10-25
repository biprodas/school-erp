// School slug rules (doc/domains-and-routing.md, section 2), copied from
// `backend/src/shared/slug/reserved-slugs.ts`. `slugs.test.ts` fails when
// the two drift apart, so change both together.

/** 3–40 of `a-z`, `0-9`, `-`; starts and ends with a letter or digit. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

/** Hosts and paths of our own that a school can never take. */
export const RESERVED_SLUGS: readonly string[] = [
  "www",
  "api",
  "app",
  "admin",
  "platform",
  "dashboard",
  "auth",
  "login",
  "signup",
  "account",
  "mail",
  "smtp",
  "email",
  "status",
  "docs",
  "help",
  "support",
  "blog",
  "static",
  "assets",
  "cdn",
  "media",
  "files",
  "billing",
  "pay",
  "payments",
  "dev",
  "staging",
  "test",
  "demo",
  "schools",
]

const RESERVED = new Set(RESERVED_SLUGS)

export const isReservedSlug = (slug: string) => RESERVED.has(slug)

export const isValidSlug = (slug: string) => SLUG_PATTERN.test(slug)

export const SLUG_MAX_LENGTH = 40

/**
 * A slug from a school's name, as the backend's `slugify` makes it:
 * `Dhaka Ideal School & College` → `dhaka-ideal-school-college`. May still
 * be too short or reserved; check with `isValidSlug`/`isReservedSlug`.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "")
}
