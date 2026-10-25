import {
  BellIcon,
  CalendarCheckIcon,
  HouseIcon,
  ReceiptTextIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react"

import type messages from "../../../messages/en.json"

export type PortalNavLabel = keyof (typeof messages)["portal"]["nav"]

export interface PortalNavItem {
  id: PortalNavLabel
  href: string
  icon: LucideIcon
}

/**
 * The portal's sections (bottom navigation on phones, tabs above). Only
 * Home is built in this slice; the rest show "Coming soon".
 */
export const PORTAL_NAV: PortalNavItem[] = [
  { id: "home", href: "/student", icon: HouseIcon },
  { id: "attendance", href: "/student/attendance", icon: CalendarCheckIcon },
  { id: "results", href: "/student/results", icon: TrophyIcon },
  { id: "fees", href: "/student/fees", icon: ReceiptTextIcon },
  { id: "notices", href: "/student/notices", icon: BellIcon },
]

/** The nav item a path belongs to (Home only for `/student` itself). */
export const activePortalItem = (pathname: string) =>
  PORTAL_NAV.find((item) =>
    item.href === "/student"
      ? pathname === "/student"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  ) ?? null

/** `href` with the selected child kept (`?child=`). */
export const withChild = (href: string, childId: string | null) =>
  childId ? `${href}?child=${encodeURIComponent(childId)}` : href
