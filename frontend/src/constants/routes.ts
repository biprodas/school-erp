// Auth routes are shared `/login` `/signup`; the HOST decides which surface
// (platform on the apex/root, tenant on subdomains + custom domains).
export const TENANT_LOGIN = "/login";
export const TENANT_SIGNUP = "/signup";
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

// Platform auth lives on the same `/login` `/signup` (apex host); only the
// post-login app area differs.
export const PLATFORM_LOGIN = "/login";
export const PLATFORM_SIGNUP = "/signup";
export const PLATFORM_LOGIN_REDIRECT = "/platform/dashboard";

// Self-service onboarding wizard — entirely on the apex host:
// register → create school → set up access → finish, then platform dashboard.
export const ONBOARDING_SIGNUP = "/onboarding/signup";
export const ONBOARDING_SCHOOL = "/onboarding/school";
// Step 3: owner sets their school password (apex; tenant resolved via header).
export const ONBOARDING_ACTIVATE = "/onboarding/activate";
// Step 4: completion screen → go to the platform dashboard.
export const ONBOARDING_COMPLETE = "/onboarding/complete";
// Resume handoff (apex host): figures out the next step for an owner who already
// has a tenant and bounces them to the right step.
export const ONBOARDING_CONTINUE = "/onboarding/continue";

// Platform management sections.
export const PLATFORM_TENANTS = "/platform/tenants";
export const PLATFORM_USERS = "/platform/users";
export const PLATFORM_MEMBERSHIPS = "/platform/memberships";

export const publicRoutes = ["/", "/faq"];

/** Auth pages — visiting these while logged in redirects to the dashboard. */
export const authRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/error",
];

/** Prefixes of areas that require an authenticated session. */
export const protectedPrefixes = [
  "/dashboard",
  "/profile",
  "/platform/dashboard",
  "/platform/tenants",
  "/platform/users",
  "/platform/memberships",
  // Onboarding steps require an authenticated platform owner. `/onboarding/signup`
  // is intentionally omitted — it's the public self-registration entry point.
  "/onboarding/school",
  "/onboarding/activate",
  "/onboarding/complete",
  "/onboarding/continue",
];

export const apiAuthPrefix = "/api/auth";

export function isAuthRoute(pathname: string): boolean {
  return authRoutes.includes(pathname);
}

export function isProtectedRoute(pathname: string): boolean {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Prefix for the self-service onboarding wizard on the apex host. */
export const onboardingPrefix = "/onboarding";

/** True for any path under the platform (super-admin) surface. */
export function isPlatformPath(pathname: string): boolean {
  return pathname === "/platform" || pathname.startsWith("/platform/");
}

/** True for any path under the onboarding wizard. */
export function isOnboardingPath(pathname: string): boolean {
  return (
    pathname === onboardingPrefix || pathname.startsWith(`${onboardingPrefix}/`)
  );
}
