import { resolveUserType } from "~/types/user";

export const ROUTES = {
  // Auth routes are shared `/login` `/signup`; the HOST decides which surface
  // (platform on the apex/root, tenant on subdomains + custom domains).
  TENANT_LOGIN: "/login",
  TENANT_SIGNUP: "/signup",
  DEFAULT_LOGIN_REDIRECT: "/dashboard",

  // Where tenant users with the "student" role land after login.
  STUDENT_LOGIN_REDIRECT: "/student/dashboard",

  // Platform auth lives on the same `/login` `/signup` (apex host); only the
  // post-login app area differs.
  PLATFORM_LOGIN: "/login",
  PLATFORM_SIGNUP: "/signup",
  PLATFORM_LOGIN_REDIRECT: "/platform/dashboard",

  // Owner/staff account activation (set password) — opened on the tenant
  // subdomain via a one-time link, then signs the user into their workspace.
  ACTIVATE: "/activate",

  // Platform management sections.
  PLATFORM_TENANTS: "/platform/tenants",
  PLATFORM_USERS: "/platform/users",
  PLATFORM_MEMBERSHIPS: "/platform/memberships",
} as const;

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
  "/student",
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

/** True for any path under the student surface. */
export function isStudentPath(pathname: string): boolean {
  return pathname === "/student" || pathname.startsWith("/student/");
}

/** Post-login landing page for a tenant user, based on their derived surface. */
export function resolveTenantLanding(roles?: string[]): string {
  return resolveUserType(roles) === "student"
    ? ROUTES.STUDENT_LOGIN_REDIRECT
    : ROUTES.DEFAULT_LOGIN_REDIRECT;
}
