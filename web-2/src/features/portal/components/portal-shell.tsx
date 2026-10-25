"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { childName } from "~/features/portal/api"
import { displayName, displaySettingsQuery } from "~/features/settings/api"
import { LanguageSwitch } from "~/components/common/language-switch"
import { SchoolLogo } from "~/components/common/school-logo"
import { ThemeToggle } from "~/components/common/theme-toggle"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { brandStyle } from "~/lib/brand-colors"
import type { SessionUser } from "~/lib/auth/types"
import { cn } from "~/lib/utils"

import { PortalMenu } from "./portal-menu"
import { activePortalItem, PORTAL_NAV, withChild } from "../portal-nav"
import { useSelectedChild } from "../use-selected-child"

/**
 * The guardian and student portal around every `/student` page, built
 * for phones first: the school and the child picker on top, sections as
 * a bottom bar at phone width and as tabs from `sm` up.
 */
export function PortalShell({
  schoolName,
  user,
  children,
}: {
  /** Until the display settings load (and if they can't). */
  schoolName: string
  user: SessionUser
  children: React.ReactNode
}) {
  const locale = useLocale()
  const display = useQuery(displaySettingsQuery())
  const name = display.data ? displayName(display.data, locale) : schoolName

  return (
    <div
      className="flex min-h-svh flex-col bg-muted/40"
      style={brandStyle(display.data?.colors.primary)}
    >
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <SchoolLogo
            name={name}
            logoUrl={display.data?.logoUrl ?? null}
            alt=""
            className="size-8"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {name}
          </span>
          <LanguageSwitch compact />
          <ThemeToggle />
          <PortalMenu fallbackUser={user} />
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-2.5">
          <ChildPicker />
        </div>
        <TopNav />
      </header>
      {/* Room for the bottom bar on phones. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-24 sm:pb-10">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

/** One child: their name and class. Several: a select. */
function ChildPicker() {
  const t = useTranslations("portal")
  const locale = useLocale()
  const { children, child, select } = useSelectedChild()

  if (children.isPending) return <Skeleton className="h-10 w-56 rounded-lg" />
  if (!child || !children.data) return null

  const placement = (c: typeof child) =>
    c.enrollment
      ? t("placement", {
          className: c.enrollment.className,
          section: c.enrollment.sectionName,
        })
      : t("notEnrolled")

  if (children.data.length === 1) {
    return (
      <p className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{childName(child, locale)}</span>
        <span className="truncate text-xs text-muted-foreground">
          {placement(child)}
        </span>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="child-picker" className="sr-only">
        {t("chooseChild")}
      </label>
      <NativeSelect
        id="child-picker"
        className="w-full sm:w-80 [&_select]:font-medium"
        value={child.studentId}
        onChange={(event) => select(event.target.value)}
      >
        {children.data.map((c) => (
          <NativeSelectOption key={c.studentId} value={c.studentId}>
            {t("childOption", {
              name: childName(c, locale),
              placement: placement(c),
            })}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

function useNavItems() {
  const t = useTranslations("portal.nav")
  const pathname = usePathname()
  const { child } = useSelectedChild()
  const active = activePortalItem(pathname)
  return PORTAL_NAV.map((item) => ({
    ...item,
    label: t(item.id),
    href: withChild(item.href, child?.studentId ?? null),
    current: active?.id === item.id,
  }))
}

function TopNav() {
  const t = useTranslations("portal")
  const items = useNavItems()
  return (
    <nav aria-label={t("navLabel")} className="max-sm:hidden">
      <ul className="mx-auto flex max-w-3xl gap-1 px-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 [&_svg]:size-4",
                item.current && "border-primary font-medium text-foreground"
              )}
            >
              <item.icon aria-hidden />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function BottomNav() {
  const t = useTranslations("portal")
  const items = useNavItems()
  return (
    <nav
      aria-label={t("navLabel")}
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] leading-tight text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset [&_svg]:size-5",
                item.current && "font-medium text-primary"
              )}
            >
              <item.icon aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
