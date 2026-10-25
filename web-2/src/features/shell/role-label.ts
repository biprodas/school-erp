"use client"

import { useTranslations } from "next-intl"

/**
 * A role's display name: system roles (`system-roles.seed.ts`) are
 * translated, custom roles keep the name the school gave them.
 */
export function useRoleLabel() {
  const t = useTranslations("shell.roles")
  return (role: string) =>
    t.has(role as never) ? t(role as never) : role.replaceAll("_", " ")
}
