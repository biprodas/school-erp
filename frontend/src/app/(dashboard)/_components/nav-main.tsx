"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { ChevronRight, Search } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { Input } from "~/components/ui/input"
import { cn } from "~/lib/utils"
import {
  isActivePath,
  menuHasOpenSubmenu,
  menuRowActive,
  type NavCategory,
  type NavMenuEntry,
} from "~/lib/sidebar-nav"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar"

export type { NavCategory, NavMenuEntry, NavSubmenuItem } from "~/lib/sidebar-nav"

/** Whether a user with `roles` (and admin flag) may see a role-gated item. */
function canSee(gate: string[] | undefined, roles: string[], isAdmin: boolean) {
  if (isAdmin) return true
  if (!gate || gate.length === 0) return true
  return gate.some((r) => roles.includes(r))
}

/**
 * Drop categories/menus/submenus the user isn't allowed to see. Admins (the
 * tenant `isAdmin` flag or the `"admin"` role) see everything. A menu whose
 * submenus are all filtered out is dropped; a category with no remaining menus
 * is dropped.
 */
function filterNavByRoles(
  categories: NavCategory[],
  roles: string[],
  isAdmin: boolean
): NavCategory[] {
  if (isAdmin || roles.includes("admin")) return categories

  const out: NavCategory[] = []
  for (const cat of categories) {
    if (!canSee(cat.roles, roles, false)) continue

    const nextMenus: NavMenuEntry[] = []
    for (const menu of cat.menus) {
      if (!canSee(menu.roles, roles, false)) continue

      if (!menu.items?.length) {
        nextMenus.push(menu)
        continue
      }
      const subs = menu.items.filter((s) => canSee(s.roles, roles, false))
      if (subs.length) nextMenus.push({ ...menu, items: subs })
    }

    if (nextMenus.length) out.push({ ...cat, menus: nextMenus })
  }
  return out
}

function normalizeQuery(q: string) {
  return q.trim().toLowerCase()
}

function filterNavCategories(
  categories: NavCategory[],
  query: string
): NavCategory[] {
  const q = normalizeQuery(query)
  if (!q) return categories

  const out: NavCategory[] = []

  for (const cat of categories) {
    const catMatches = cat.label.toLowerCase().includes(q)
    const nextMenus: NavMenuEntry[] = []

    for (const menu of cat.menus) {
      if (catMatches) {
        nextMenus.push(menu)
        continue
      }
      const subs = menu.items
      const menuMatches = menu.title.toLowerCase().includes(q)
      if (!subs?.length) {
        if (menuMatches) nextMenus.push(menu)
        continue
      }
      if (menuMatches) {
        nextMenus.push(menu)
        continue
      }
      const filteredSubs = subs.filter((s) =>
        s.title.toLowerCase().includes(q)
      )
      if (filteredSubs.length) {
        nextMenus.push({ ...menu, items: filteredSubs })
      }
    }

    if (nextMenus.length) {
      out.push({ ...cat, menus: nextMenus })
    }
  }

  return out
}

export function NavMain({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const roles = React.useMemo(
    () => session?.user?.roles ?? [],
    [session?.user?.roles]
  )
  const isAdmin = session?.user?.isAdmin ?? false
  const [filter, setFilter] = React.useState("")
  const filterActive = normalizeQuery(filter).length > 0

  // Role gate first (what the user is allowed to see), then the search filter.
  const allowedCategories = React.useMemo(
    () => filterNavByRoles(categories, roles, isAdmin),
    [categories, roles, isAdmin]
  )
  const visibleCategories = React.useMemo(
    () => filterNavCategories(allowedCategories, filter),
    [allowedCategories, filter]
  )

  return (
    <>
      <SidebarGroup className="pb-0">
        <div className="relative px-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter menus…"
            className="h-8 bg-sidebar-accent/40 pl-9"
            aria-label="Filter sidebar menus"
          />
        </div>
      </SidebarGroup>
      {filterActive && visibleCategories.length === 0 ? (
        <SidebarGroup>
          <p className="text-muted-foreground px-2 text-xs">
            No menus match &ldquo;{filter.trim()}&rdquo;.
          </p>
        </SidebarGroup>
      ) : null}
      {visibleCategories.map((category) => (
        <SidebarGroup key={category.label}>
          <SidebarGroupLabel className="flex items-center gap-2">
            {category.accentDot ? (
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  category.accentDot
                )}
                aria-hidden
              />
            ) : null}
            <span className="font-semibold tracking-wide uppercase">
              {category.label}
            </span>
          </SidebarGroupLabel>
          <SidebarMenu>
            {category.menus.map((menu) => {
              const hasSub = Boolean(menu.items?.length)

              if (!hasSub) {
                const active = isActivePath(pathname, menu.url, {
                  exact: menu.exact,
                })
                return (
                  <SidebarMenuItem key={menu.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={menu.title}
                    >
                      <Link href={menu.url}>
                        <menu.icon />
                        <span>{menu.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              }

              const defaultOpen =
                filterActive ||
                menuHasOpenSubmenu(menu.items, pathname) ||
                isActivePath(pathname, menu.url, { exact: menu.exact })

              const rowActive = menuRowActive(pathname, menu, true)

              return (
                <Collapsible
                  key={
                    filterActive
                      ? `${menu.title}-${normalizeQuery(filter)}`
                      : menu.title
                  }
                  asChild
                  defaultOpen={defaultOpen}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={rowActive}
                      tooltip={menu.title}
                    >
                      <Link href={menu.url}>
                        <menu.icon />
                        <span>{menu.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRight />
                        <span className="sr-only">Toggle submenu</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {menu.items!.map((sub) => (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActivePath(pathname, sub.url, {
                                exact: sub.exact,
                              })}
                            >
                              <Link href={sub.url}>
                                <sub.icon className="size-4 shrink-0" />
                                <span>{sub.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
