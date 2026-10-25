"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { visibleNav } from "~/features/shell/nav/nav"
import type { Permissions } from "~/features/access/permissions"

/**
 * A tile for every menu the member can open: the home page for members
 * without any dashboard key.
 */
export function MenuTiles({ permissions }: { permissions: Permissions }) {
  const t = useTranslations("shell.home")
  const tn = useTranslations("nav")

  const menus = visibleNav(permissions)
    .flatMap((category) =>
      category.menus.map((menu) => ({ menu, category: category.id }))
    )
    .filter(({ menu }) => menu.id !== "dashboard")

  if (menus.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noMenus")}</p>
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {menus.map(({ menu, category }) => {
        const Icon = menu.icon
        const href = menu.href ?? menu.items?.[0]?.href ?? "/dashboard"
        return (
          <li key={menu.id}>
            <Link
              href={href}
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
                <Icon aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {tn(`labels.${menu.id}`)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {tn(`categories.${category}`)}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
