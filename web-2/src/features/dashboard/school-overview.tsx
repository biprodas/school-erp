"use client"

import { useQuery } from "@tanstack/react-query"
import {
  BanknoteIcon,
  BriefcaseBusinessIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import {
  adminDashboardQuery,
  type AdminDashboard,
  type AgingBucket,
} from "~/api/dashboards"
import { Badge } from "~/components/ui/badge"
import { useSchoolFormat } from "~/hooks/use-school-format"

import { BarList } from "./bar-list"
import { StatGrid, StatTile } from "./stat-tile"
import { GroupSkeleton, WidgetCard, WidgetGroup } from "./widget-group"

/** Message keys for the aging buckets (keys can't contain `-`). */
export const BUCKET_KEYS: Record<AgingBucket, string> = {
  current: "current",
  "0-30": "d0to30",
  "31-60": "d31to60",
  "61-90": "d61to90",
  "90+": "d90plus",
}

/** `dashboard_admin:read`: the whole school today. */
export function SchoolOverview() {
  const t = useTranslations("dashboard.overview")
  const f = useSchoolFormat()
  const query = useQuery(adminDashboardQuery())

  return (
    <WidgetGroup
      id="school-overview"
      title={t("title")}
      description={(data) => t("description", { date: f.date(data.date) })}
      query={query}
      skeleton={<GroupSkeleton tiles={6} cards={2} />}
    >
      {(data) => <Overview data={data} />}
    </WidgetGroup>
  )
}

function Overview({ data }: { data: AdminDashboard }) {
  const t = useTranslations("dashboard")
  const f = useSchoolFormat()
  const attendance = data.attendanceToday

  return (
    <div className="flex flex-col gap-3">
      <StatGrid>
        <StatTile
          icon={<UsersIcon />}
          label={t("tiles.students")}
          value={f.number(data.enrollment.total)}
          hint={t("tiles.studentsHint")}
        />
        <StatTile
          icon={<CalendarCheckIcon />}
          label={t("tiles.attendance")}
          value={
            attendance?.percentage != null
              ? f.percent(attendance.percentage)
              : "—"
          }
          hint={
            attendance
              ? t("tiles.registersIn", {
                  submitted: f.number(attendance.submitted),
                  sections: f.number(attendance.sections),
                })
              : t("tiles.noSession")
          }
        />
        <StatTile
          icon={<BanknoteIcon />}
          label={t("tiles.collectedToday")}
          value={f.moneyShort(data.collection.today.total)}
          hint={t("tiles.payments", {
            count: data.collection.today.payments,
            n: f.number(data.collection.today.payments),
          })}
        />
        <StatTile
          icon={<BanknoteIcon />}
          label={t("tiles.collectedMonth")}
          value={f.moneyShort(data.collection.monthToDate.total)}
          hint={t("tiles.payments", {
            count: data.collection.monthToDate.payments,
            n: f.number(data.collection.monthToDate.payments),
          })}
        />
        <StatTile
          icon={<WalletIcon />}
          label={t("tiles.dues")}
          value={f.moneyShort(data.dues.outstanding)}
          hint={t("tiles.students_count", {
            count: data.dues.students,
            n: f.number(data.dues.students),
          })}
        />
        <StatTile
          icon={<BriefcaseBusinessIcon />}
          label={t("tiles.staff")}
          value={f.number(data.staff.active)}
        />
      </StatGrid>

      <div className="grid gap-3 lg:grid-cols-2">
        <WidgetCard
          title={t("overview.enrollmentTitle")}
          description={t("overview.enrollmentDescription")}
        >
          {data.enrollment.byClass.length === 0 ? (
            <Empty>{t("overview.enrollmentEmpty")}</Empty>
          ) : (
            <BarList
              label={t("overview.enrollmentTitle")}
              rows={data.enrollment.byClass.map((c) => ({
                id: c.classId,
                label: c.className,
                value: c.students,
                display: f.number(c.students),
              }))}
            />
          )}
        </WidgetCard>

        <WidgetCard
          title={t("overview.attendanceTitle")}
          description={t("overview.attendanceDescription")}
        >
          {!attendance ? (
            <Empty>{t("tiles.noSession")}</Empty>
          ) : attendance.byClass.length === 0 ? (
            <Empty>{t("overview.attendanceEmpty")}</Empty>
          ) : (
            <BarList
              label={t("overview.attendanceTitle")}
              max={100}
              rows={attendance.byClass.map((c) => ({
                id: c.classId,
                label: c.className,
                value: c.percentage,
                display:
                  c.percentage === null
                    ? t("overview.notTaken")
                    : f.percent(c.percentage),
                detail: t("overview.registersOf", {
                  submitted: f.number(c.submitted),
                  sections: f.number(c.sections),
                }),
              }))}
            />
          )}
        </WidgetCard>

        <WidgetCard
          title={t("overview.duesTitle")}
          description={t("overview.duesDescription")}
        >
          {data.dues.outstanding === 0 ? (
            <Empty>{t("overview.duesEmpty")}</Empty>
          ) : (
            <BarList
              label={t("overview.duesTitle")}
              rows={(Object.keys(BUCKET_KEYS) as AgingBucket[]).map(
                (bucket) => ({
                  id: bucket,
                  label: t(`buckets.${BUCKET_KEYS[bucket]}` as never),
                  value: data.dues.buckets[bucket] ?? 0,
                  display: f.moneyShort(data.dues.buckets[bucket] ?? 0),
                })
              )}
            />
          )}
        </WidgetCard>

        <WidgetCard title={t("overview.upcomingTitle")}>
          {data.upcoming.length === 0 ? (
            <Empty>{t("overview.upcomingEmpty")}</Empty>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.upcoming.map((event, i) => (
                <li
                  key={`${event.kind}-${event.date}-${i}`}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                    {event.kind === "exam" ? (
                      <ClipboardListIcon aria-hidden />
                    ) : (
                      <CalendarDaysIcon aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {event.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {event.endDate && event.endDate !== event.date
                        ? t("overview.dateRange", {
                            from: f.date(event.date),
                            to: f.date(event.endDate),
                          })
                        : f.date(event.date)}
                    </span>
                  </span>
                  <Badge variant="secondary">
                    {t(
                      event.kind === "exam"
                        ? "overview.exam"
                        : "overview.holiday"
                    )}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>
}
