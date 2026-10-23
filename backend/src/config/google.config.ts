import { registerAs } from '@nestjs/config';

const googleConfig = registerAs('google', () => {
  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
  return {
    // Google sign-in is off (routes answer 404) until both are set.
    clientId: process.env.GOOGLE_CLIENT_ID || undefined,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
    // The one callback every host uses (doc/domains-and-routing.md 5a); the
    // frontend proxies /api to the backend.
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI || `${appUrl}/api/oauth/google/callback`,
  };
});

export type GoogleConfig = ReturnType<typeof googleConfig>;
export default googleConfig;
