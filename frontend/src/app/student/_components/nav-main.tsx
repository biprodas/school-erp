"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar"
import {
  isActivePath,
  menuHasOpenSubmenu,
  menuRowActive,
  type NavMenuEntry,
} from "~/lib/sidebar-nav"

export const NavMain = ({ items }: { items: NavMenuEntry[] }) => {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((menu) => {
            const hasSub = Boolean(menu.items?.length)

            if (!hasSub) {
              return (
                <SidebarMenuItem key={menu.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(pathname, menu.url, {
                      exact: menu.exact,
                    })}
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
              menuHasOpenSubmenu(menu.items, pathname) ||
              isActivePath(pathname, menu.url, { exact: menu.exact })

            return (
              <Collapsible key={menu.title} asChild defaultOpen={defaultOpen}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={menuRowActive(pathname, menu, true)}
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
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
