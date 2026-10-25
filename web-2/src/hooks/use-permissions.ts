"use client"

import { useQuery } from "@tanstack/react-query"

import { meQuery } from "~/api/auth"
import { toPermissions, type Permissions } from "~/lib/permissions"

/**
 * The member's permissions from `GET /auth/me` (hydrated by the dashboard
 * layout, refetched on focus). None while it loads.
 */
export function usePermissions(): Permissions {
  const { data } = useQuery({ ...meQuery(), select: toPermissions })
  return data ?? toPermissions(null)
}
