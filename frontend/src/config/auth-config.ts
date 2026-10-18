const AUTH_SECRET = process.env.AUTH_SECRET;

export const authConfig = {
  secret: AUTH_SECRET,
  trustHost: true,
  sessionStrategy: "jwt",
} as const;

export type AuthConfig = typeof authConfig;
