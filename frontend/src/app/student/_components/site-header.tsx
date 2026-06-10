"use client"

import { Separator } from "~/components/ui/separator"
import { SidebarTrigger } from "~/components/ui/sidebar"
import { ThemeToggleButton } from "~/components/theme-toggle-button"
import { NavUser } from "./nav-user"
import { SiteBreadcrumb } from "~/components/site-breadcrumb"

export const SiteHeader = () => {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <SiteBreadcrumb />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggleButton />
          <NavUser mode="avatar" />
        </div>
      </div>
    </header>
  )
}
