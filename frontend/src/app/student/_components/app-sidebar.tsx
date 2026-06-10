"use client"

import Link from "next/link"
import * as React from "react"
import { FaBookOpenReader } from "react-icons/fa6"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"
import { NavMain } from "./nav-main"
import { studentNav } from "./sidebar-nav"

export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/student/dashboard">
                <FaBookOpenReader className="size-6!" />
                <span className="text-base font-semibold">School ERP</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={studentNav} />
      </SidebarContent>
    </Sidebar>
  )
}
