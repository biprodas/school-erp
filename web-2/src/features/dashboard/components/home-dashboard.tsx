"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"

import { meQuery } from "~/features/auth/api"
import { PageHeader } from "~/components/layouts/page-header"
import { Skeleton } from "~/components/ui/skeleton"
import {
  can,
  toPermissions,
  type Permissions,
} from "~/features/access/permissions"

import { Finance } from "./finance"
import { MenuTiles } from "./menu-tiles"
import { MyDay } from "./my-day"
import { OnboardingBanner } from "./onboarding-banner"
import { SchoolOverview } from "./school-overview"

/** Which groups the home page shows (doc/frontend-implementation-plan.md 5.5). */
export function homeGroups(permissions: Permissions) {
  return {
    onboarding: can(permissions, "onboarding:manage"),
    overview: can(permissions, "dashboard_admin:read"),
    myDay: can(permissions, "dashboard_teacher:read"),
    finance: can(permissions, "dashboard_accountant:read"),
  }
}

/**
 * `/dashboard`: a greeting, then every dashboard group the member's keys
 * open, each loading and failing on its own. A principal who is also an
 * accountant sees both. Members with none of the keys get their menus.
 */
export function HomeDashboard() {
  const t = useTranslations("shell.home")
  const me = useQuery(meQuery())
  const permissions = toPermissions(me.data)
  const groups = homeGroups(permissions)
  const name = me.data?.name ?? me.data?.email ?? me.data?.phone
  const any = groups.overview || groups.myDay || groups.finance

  return (
    <>
      <PageHeader
        title={name ? t("titleNamed", { name }) : t("title")}
        description={any ? undefined : t("body")}
      />
      {me.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : any ? (
        <div className="flex flex-col gap-10">
          {groups.onboarding && <OnboardingBanner />}
          {groups.myDay && <MyDay />}
          {groups.overview && <SchoolOverview />}
          {groups.finance && <Finance />}
        </div>
      ) : (
        <MenuTiles permissions={permissions} />
      )}
    </>
  )
}
