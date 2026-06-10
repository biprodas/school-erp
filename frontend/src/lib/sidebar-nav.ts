import type { LucideIcon } from "lucide-react"

/**
 * Shared sidebar navigation types + active-path helpers, used by both the staff
 * dashboard (`(dashboard)/_components/nav-main.tsx`, 3-level category → menu →
 * submenu) and the student portal (`student/_components/nav-main.tsx`, 2-level
 * menu → submenu).
 */

/**
 * Optional role gate. When omitted, an item is visible to all staff. When set,
 * a user sees the item only if they hold one of these roles. Tenant admins
 * (`isAdmin`) and users with the `"admin"` role bypass every gate.
 */
export type RoleGated = { roles?: string[] }

/** Third level: links under a menu (category → menu → submenu). */
export type NavSubmenuItem = RoleGated & {
  title: string
  url: string
  icon: LucideIcon
  exact?: boolean
}

/** Second level: one collapsible row (optional submenu). */
export type NavMenuEntry = RoleGated & {
  title: string
  /** Primary navigation target for the menu row. */
  url: string
  icon: LucideIcon
  /** Use for leaf routes like `/dashboard` so nested paths don’t highlight it. */
  exact?: boolean
  /** Submenu entries; omit or leave empty for a single leaf link. */
  items?: NavSubmenuItem[]
}

/** Top level: sidebar section grouping related menus. */
export type NavCategory = RoleGated & {
  label: string
  /** Tailwind background class for the category marker dot (e.g. `bg-violet-500`). */
  accentDot?: string
  menus: NavMenuEntry[]
}

export function normalizePath(p: string) {
  if (!p || p === "#") return ""
  const t = p.replace(/\/$/, "")
  return t === "" ? "/" : t
}

export function isActivePath(
  pathname: string,
  url: string,
  options?: { exact?: boolean }
): boolean {
  const path = normalizePath(pathname)
  const target = normalizePath(url)
  if (!target || target === "#") return false
  if (options?.exact) return path === target
  return path === target || path.startsWith(`${target}/`)
}

export function menuHasOpenSubmenu(
  items: NavSubmenuItem[] | undefined,
  pathname: string
) {
  return Boolean(
    items?.some((sub) => isActivePath(pathname, sub.url, { exact: sub.exact }))
  )
}

export function menuRowActive(
  pathname: string,
  menu: NavMenuEntry,
  hasSub: boolean
): boolean {
  if (!hasSub) {
    return isActivePath(pathname, menu.url, { exact: menu.exact })
  }
  return (
    menuHasOpenSubmenu(menu.items, pathname) ||
    isActivePath(pathname, menu.url, { exact: menu.exact })
  )
}
