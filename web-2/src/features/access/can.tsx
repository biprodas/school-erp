"use client"

import { usePermissions } from "~/features/access/use-permissions"
import { allows, type Requirement } from "~/features/access/permissions"

/**
 * Renders `children` only for members who hold `permission` (one key, or
 * any of several), else `fallback`. For hiding UI only: the backend checks
 * every request itself.
 */
export function Can({
  permission,
  adminOnly,
  fallback = null,
  children,
}: Requirement & { fallback?: React.ReactNode; children: React.ReactNode }) {
  const permissions = usePermissions()
  return allows(permissions, { permission, adminOnly }) ? children : fallback
}
