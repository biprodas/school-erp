"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api/client";
import { useTenantQueryEnabled } from "~/apis/tenanted/shared";
import type { PermissionGroup } from "./types";

/** Co-located React Query keys for the permission catalog. */
export const tenantPermissionKeys = {
  all: ["tenant", "permissions"] as const,
  catalog: () => [...tenantPermissionKeys.all, "catalog"] as const,
};

// ---- Transport ----

// `GET /permissions` returns a bare array (no `{ data }` envelope), which the
// axios interceptor passes through unchanged.
export const getPermissionCatalog = () =>
  api.get<PermissionGroup[]>("/permissions");

// ---- Hooks ----

export const useTenantPermissionCatalog = (options?: { enabled?: boolean }) => {
  const tenantEnabled = useTenantQueryEnabled();
  return useQuery({
    queryKey: tenantPermissionKeys.catalog(),
    queryFn: getPermissionCatalog,
    enabled: tenantEnabled && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000, // catalog is code-defined; rarely changes
  });
};
