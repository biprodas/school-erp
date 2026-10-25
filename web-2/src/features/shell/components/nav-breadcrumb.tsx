"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Fragment } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { navTrail, type Crumb } from "~/features/shell/nav/nav"

/**
 * Where the page sits: Dashboard › menu › page, from the nav labels. On
 * phones only the page itself is shown.
 */
export function NavBreadcrumb() {
  const t = useTranslations("nav.labels")
  const pathname = usePathname()
  const trail = navTrail(pathname)
  const crumbs: Crumb[] =
    trail[0]?.id === "dashboard"
      ? trail
      : [{ id: "dashboard", href: "/dashboard" }, ...trail]

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <Fragment key={`${crumb.id}-${index}`}>
              {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
              <BreadcrumbItem
                className={last ? "min-w-0" : "hidden md:inline-flex"}
              >
                {last ? (
                  <BreadcrumbPage className="truncate">
                    {t(crumb.id)}
                  </BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {t(crumb.id)}
                  </BreadcrumbLink>
                ) : (
                  <span>{t(crumb.id)}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
