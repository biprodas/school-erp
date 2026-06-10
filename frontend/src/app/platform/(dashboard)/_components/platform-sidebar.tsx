"use client";

import { Building2, LayoutDashboard, ShieldUser, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { FaSchool } from "react-icons/fa6";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { ROUTES } from "~/constants";

const NAV_ITEMS = [
  { title: "Overview", url: ROUTES.PLATFORM_LOGIN_REDIRECT, icon: LayoutDashboard },
  { title: "Tenants", url: ROUTES.PLATFORM_TENANTS, icon: Building2 },
  { title: "Users", url: ROUTES.PLATFORM_USERS, icon: ShieldUser },
  { title: "Memberships", url: ROUTES.PLATFORM_MEMBERSHIPS, icon: Users },
] as const;

export function PlatformSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href={ROUTES.PLATFORM_LOGIN_REDIRECT}>
                <FaSchool className="size-5!" />
                <span className="text-base font-semibold">
                  SchoolERP Platform
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ title, url, icon: Icon }) => {
                const isActive =
                  pathname === url || pathname.startsWith(`${url}/`);
                return (
                  <SidebarMenuItem key={title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={url}>
                        <Icon />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
