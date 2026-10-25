"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { meQuery } from "~/api/auth"
import { displayName, displaySettingsQuery } from "~/api/settings"
import { SchoolLogo } from "~/components/school-logo"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar"
import type { NavMenu } from "~/config/nav"
import { activeHref, searchNav, visibleNav } from "~/lib/nav"
import { toPermissions } from "~/lib/permissions"

/**
 * The staff sidebar: the menus this member's permission keys open, with
 * search over their labels. Icons only when collapsed on desktop (the
 * state is kept in the `sidebar_state` cookie), a sheet on phones.
 */
export function AppSidebar({ fallbackName }: { fallbackName: string }) {
  const t = useTranslations("nav")
  const ts = useTranslations("shell")
  const locale = useLocale()
  const pathname = usePathname()
  const me = useQuery(meQuery())
  const display = useQuery(displaySettingsQuery())
  const [query, setQuery] = useState("")

  const name = display.data ? displayName(display.data, locale) : fallbackName
  const allowed = visibleNav(toPermissions(me.data))
  const nav = searchNav(allowed, query, (id) => t(`labels.${id}`))
  const active = activeHref(pathname, allowed)
  const searching = query.trim().length > 0

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={name}
              render={<Link href="/dashboard" />}
            >
              <SchoolLogo
                name={name}
                logoUrl={display.data?.logoUrl ?? null}
                alt=""
                className="size-8 rounded-lg after:rounded-lg"
              />
              <span className="truncate font-display font-semibold">
                {name}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="relative group-data-[collapsible=icon]:hidden">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <SidebarInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ts("searchMenus")}
            aria-label={ts("searchMenus")}
            className="pl-8"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={ts("mainMenu")} className="flex flex-col gap-2">
          {me.isPending ? (
            <SidebarGroup>
              <SidebarMenu>
                {Array.from({ length: 6 }, (_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ) : nav.length === 0 ? (
            <p className="px-4 py-2 text-sm text-muted-foreground">
              {ts("noMenusMatch")}
            </p>
          ) : (
            nav.map((category) => (
              <SidebarGroup key={category.id}>
                <SidebarGroupLabel>
                  {t(`categories.${category.id}`)}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {category.menus.map((menu) => (
                      <NavMenuItem
                        key={menu.id}
                        menu={menu}
                        active={active}
                        forceOpen={searching}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          )}
        </nav>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function NavMenuItem({
  menu,
  active,
  forceOpen,
}: {
  menu: NavMenu
  active: string | null
  forceOpen: boolean
}) {
  const t = useTranslations("nav.labels")
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar()
  const label = t(menu.id)
  const Icon = menu.icon
  const containsActive = !!menu.items?.some((item) => item.href === active)
  // Open on the active menu until the user toggles it.
  const [toggled, setMenuOpen] = useState<boolean | null>(null)
  const open = forceOpen || (toggled ?? containsActive)
  // Phones: the sheet closes once a link is chosen.
  const closeSheet = () => {
    if (isMobile) setOpenMobile(false)
  }

  if (!menu.items) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={label}
          isActive={menu.href === active}
          render={
            <Link
              href={menu.href ?? "/dashboard"}
              aria-current={menu.href === active ? "page" : undefined}
              onClick={closeSheet}
            />
          }
        >
          <Icon />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setMenuOpen}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        render={
          <SidebarMenuButton
            tooltip={label}
            isActive={containsActive && state === "collapsed" && !isMobile}
            onClick={() => {
              // Collapsed to icons: open the sidebar on this menu instead.
              if (state === "collapsed" && !isMobile) {
                setOpen(true)
                setMenuOpen(true)
              }
            }}
          />
        }
      >
        <Icon />
        <span>{label}</span>
        <ChevronRightIcon
          aria-hidden
          className="ml-auto transition-transform duration-200 in-data-panel-open:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {menu.items.map((item) => (
            <SidebarMenuSubItem key={item.id}>
              <SidebarMenuSubButton
                isActive={item.href === active}
                render={
                  <Link
                    href={item.href}
                    aria-current={item.href === active ? "page" : undefined}
                    onClick={closeSheet}
                  />
                }
              >
                <span>{t(item.id)}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}
