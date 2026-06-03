// Tenant (school) auth + app routes
export const TENANT_LOGIN = "/login";
export const TENANT_SIGNUP = "/signup";
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

// Platform (super-admin) auth + app routes
export const PLATFORM_LOGIN = "/platform/login";
export const PLATFORM_SIGNUP = "/platform/signup";
export const PLATFORM_LOGIN_REDIRECT = "/platform/dashboard";

export const publicRoutes = ["/", "/faq"];

/** Auth pages — visiting these while logged in redirects to the dashboard. */
export const authRoutes = [
  TENANT_LOGIN,
  TENANT_SIGNUP,
  "/forgot-password",
  "/reset-password",
  "/error",
  PLATFORM_LOGIN,
  PLATFORM_SIGNUP,
];

/** Prefixes of areas that require an authenticated session. */
export const protectedPrefixes = [
  "/dashboard",
  "/profile",
  "/platform/dashboard",
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

/** True for any path under the platform (super-admin) surface. */
export function isPlatformPath(pathname: string): boolean {
  return pathname === "/platform" || pathname.startsWith("/platform/");
}
