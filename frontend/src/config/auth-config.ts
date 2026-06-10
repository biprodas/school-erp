const AUTH_SECRET = process.env.AUTH_SECRET;
const AUTH_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || undefined;

export const authConfig = {
  secret: AUTH_SECRET,
  trustHost: true,
  sessionStrategy: "jwt",
  cookieDomain: AUTH_COOKIE_DOMAIN,
} as const;

export type AuthConfig = typeof authConfig;
