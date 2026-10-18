const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_API_URL ?? "http://localhost:3900/api";
const TENANT_HEADER = "x-tenant-id";

export const apiConfig = {
  baseUrl: API_BASE_URL,
  tenantHeader: TENANT_HEADER,
} as const;

export type ApiConfig = typeof apiConfig;

/** Backend auth endpoints, grouped by auth surface. */
export const AUTH_ENDPOINTS = {
  tenant: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
    handoff: "/auth/handoff",
  },
  platform: {
    login: "/platform/auth/login",
    register: "/platform/auth/register",
    me: "/platform/auth/me",
    handoff: "/platform/auth/handoff",
  },
} as const;

