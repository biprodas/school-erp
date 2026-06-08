// Site metadata.
export const SITE = {
  NAME: "StartDescribe",
  URL: "https://startdescribe.com",
  SUPPORT_CONTACT_EMAIL: "contact@startdescribe.com",
  CUSTOM_CALL_URL: "#",
} as const;

export const ROUTES = {
  // Auth routes are shared `/login` `/signup`; the HOST decides which surface
  // (platform on the apex/root, tenant on subdomains + custom domains).
  TENANT_LOGIN: "/login",
  TENANT_SIGNUP: "/signup",
  DEFAULT_LOGIN_REDIRECT: "/dashboard",

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
