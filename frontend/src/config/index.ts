/** Centralized runtime config. */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_API_URL ?? "http://localhost:3900/api";

/** Backend auth endpoints, grouped by auth surface. */
export const AUTH_ENDPOINTS = {
  tenant: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
  },
  platform: {
    login: "/platform/auth/login",
    register: "/platform/auth/register",
    me: "/platform/auth/me",
  },
} as const;

/** Header the backend reads to resolve the active tenant. */
export const TENANT_HEADER = "x-tenant-id";
