import {
  EXTRA_PAGES,
  NAV,
  type NavCategory,
  type NavLabel,
  type NavMenu,
} from "~/config/nav"

import { allows, type Permissions } from "./permissions"

/**
 * The sidebar this member may see: items they hold the key for, menus
 * with at least one such item (or a link they may open), categories with
 * at least one menu.
 */
export function visibleNav(
  permissions: Permissions,
  nav: NavCategory[] = NAV
): NavCategory[] {
  return nav
    .map((category) => ({
      ...category,
      menus: category.menus.flatMap((menu): NavMenu[] => {
        if (!allows(permissions, menu)) return []
        if (!menu.items) return [menu]
        const items = menu.items.filter((item) => allows(permissions, item))
        return items.length ? [{ ...menu, items }] : []
      }),
    }))
    .filter((category) => category.menus.length > 0)
}

const trimSlash = (path: string) =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path

const covers = (href: string, exact: boolean | undefined, path: string) =>
  path === href || (!exact && path.startsWith(`${href}/`))

/** Every link in the sidebar with the menu it sits in. */
function links(nav: NavCategory[]) {
  return nav.flatMap((category) =>
    category.menus.flatMap((menu) =>
      menu.items
        ? menu.items.map((item) => ({ menu, item }))
        : menu.href
          ? [
              {
                menu,
                item: { id: menu.id, href: menu.href, exact: menu.exact },
              },
            ]
          : []
    )
  )
}

/**
 * The sidebar link to highlight on `pathname`: the longest one that covers
 * it, so `/dashboard/students/new` highlights "Admit a student", not the
 * directory at `/dashboard/students`.
 */
export function activeHref(
  pathname: string,
  nav: NavCategory[] = NAV
): string | null {
  const path = trimSlash(pathname)
  let best: string | null = null
  for (const { item } of links(nav)) {
    if (covers(item.href, item.exact, path)) {
      if (!best || item.href.length > best.length) best = item.href
    }
  }
  return best
}

export interface Crumb {
  id: NavLabel
  /** Null for a menu that is only a group. */
  href: string | null
}

/**
 * Breadcrumb for `pathname`: menu then item (`Students › Admit a student`),
 * or the one page for a menu that is a link. Pages below a known one
 * (`/dashboard/students/<id>`) get its trail. Empty for unknown paths.
 */
export function navTrail(pathname: string, nav: NavCategory[] = NAV): Crumb[] {
  const path = trimSlash(pathname)
  const extra = EXTRA_PAGES.find((page) => covers(page.href, false, path))
  if (extra) return [{ id: extra.id, href: extra.href }]

  const href = activeHref(path, nav)
  const link = href && links(nav).find(({ item }) => item.href === href)
  if (!link) return []
  if (link.menu.id === link.item.id) return [{ id: link.menu.id, href }]
  return [
    { id: link.menu.id, href: link.menu.href ?? null },
    { id: link.item.id, href },
  ]
}

/** The label of the page at exactly `pathname`, or null. */
export function pageLabel(
  pathname: string,
  nav: NavCategory[] = NAV
): NavLabel | null {
  const path = trimSlash(pathname)
  const all = [...links(nav).map(({ item }) => item), ...EXTRA_PAGES]
  return all.find((page) => page.href === path)?.id ?? null
}

/**
 * Menus whose label, or one of whose items' labels, contains `query`
 * (in the viewer's language, ignoring case). A menu that matches keeps
 * all its items; otherwise only the matching items stay.
 */
export function searchNav(
  nav: NavCategory[],
  query: string,
  label: (id: NavLabel) => string
): NavCategory[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return nav
  const hit = (id: NavLabel) => label(id).toLocaleLowerCase().includes(needle)

  return nav
    .map((category) => ({
      ...category,
      menus: category.menus.flatMap((menu): NavMenu[] => {
        if (hit(menu.id)) return [menu]
        const items = menu.items?.filter((item) => hit(item.id)) ?? []
        return items.length ? [{ ...menu, items }] : []
      }),
    }))
    .filter((category) => category.menus.length > 0)
}
