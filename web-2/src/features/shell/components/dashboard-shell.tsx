"use client"

import { useQuery } from "@tanstack/react-query"

import { displaySettingsQuery } from "~/features/settings/api"
import { LanguageSwitch } from "~/components/common/language-switch"
import { ThemeToggle } from "~/components/common/theme-toggle"
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { brandStyle } from "~/lib/brand-colors"
import type { SessionUser } from "~/lib/auth/types"

import { AppSidebar } from "./app-sidebar"
import { NavBreadcrumb } from "./nav-breadcrumb"
import { NotificationBell } from "./notification-bell"
import { UserMenu } from "./user-menu"

/**
 * The staff app around every `/dashboard` page: sidebar, header
 * (breadcrumb, bell, language, theme, account) and the school's primary
 * color as CSS variables.
 */
export function DashboardShell({
  defaultOpen,
  schoolName,
  user,
  children,
}: {
  /** From the `sidebar_state` cookie, so a collapsed sidebar stays so. */
  defaultOpen: boolean
  /** Until the display settings load (and if they can't). */
  schoolName: string
  user: SessionUser
  children: React.ReactNode
}) {
  const display = useQuery(displaySettingsQuery())

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={brandStyle(display.data?.colors.primary) as React.CSSProperties}
    >
      <AppSidebar fallbackName={schoolName} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-1 data-[orientation=vertical]:h-4"
          />
          <NavBreadcrumb />
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <NotificationBell />
            <LanguageSwitch />
            <ThemeToggle />
            <UserMenu fallbackUser={user} />
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
