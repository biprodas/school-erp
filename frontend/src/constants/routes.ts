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
