/**
 * Where the product app lives. The marketing site only links into it: signup
 * and platform login on the app's apex host, and each school on its own
 * subdomain (`<slug>.<root-domain>`).
 */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "lvh.me";

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@kampasy.com";

export const APP_LINKS = {
  signup: `${APP_URL}/signup`,
  login: `${APP_URL}/login`,
} as const;

/** `https://greenfield.kampasy.com/login`, keeping the app's protocol and port. */
export function schoolLoginUrl(slug: string): string {
  const { protocol, port } = new URL(APP_URL);
  return `${protocol}//${slug}.${ROOT_DOMAIN}${port ? `:${port}` : ""}/login`;
}

export const COMPANY_LOCATION =
  process.env.NEXT_PUBLIC_COMPANY_LOCATION || "Dhaka, Bangladesh";
