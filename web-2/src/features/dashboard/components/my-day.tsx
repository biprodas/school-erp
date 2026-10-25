"use client"

import { useQuery } from "@tanstack/react-query"
import {
  CalendarCheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ClipboardPenIcon,
  PalmtreeIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import {
  teacherDashboardQuery,
  type TeacherDashboard,
} from "~/features/dashboard/api"
import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import { Empty } from "./school-overview"
import { StatGrid, StatTile } from "./stat-tile"
import { GroupSkeleton, WidgetCard, WidgetGroup } from "./widget-group"

/** Where "Take attendance" and "Enter marks" go (screens to come). */
export const takeAttendanceHref = (sectionId: string) =>
  `/dashboard/attendance/take?section=${encodeURIComponent(sectionId)}`
export const enterMarksHref = (sheetId: string) =>
  `/dashboard/exams/marks?sheet=${encodeURIComponent(sheetId)}`

/** `dashboard_teacher:read`: the teacher's sections and marks today. */
export function MyDay() {
  const t = useTranslations("dashboard.myDay")
  const f = useSchoolFormat()
  const query = useQuery(teacherDashboardQuery())

  return (
    <WidgetGroup
      id="my-day"
      title={t("title")}
      description={(data) => t("description", { date: f.date(data.date) })}
      query={query}
      skeleton={<GroupSkeleton tiles={2} cards={2} />}
    >
      {(data) => <Day data={data} />}
    </WidgetGroup>
  )
}

const STATUS_ICON = {
  submitted: CircleCheckIcon,
  pending: CircleDashedIcon,
  holiday: PalmtreeIcon,
} as const

function Day({ data }: { data: TeacherDashboard }) {
  const t = useTranslations("dashboard.myDay")
  const f = useSchoolFormat()

  return (
    <div className="flex flex-col gap-3">
      <StatGrid>
        <StatTile
          icon={<CalendarCheckIcon />}
          label={t("pendingAttendance")}
          value={f.number(data.pendingAttendance)}
          hint={t("sectionsToday", {
            count: data.sections.length,
            n: f.number(data.sections.length),
          })}
        />
        <StatTile
          icon={<ClipboardPenIcon />}
          label={t("pendingMarks")}
          value={f.number(data.pendingMarkSheets.length)}
        />
      </StatGrid>

      <div className="grid gap-3 lg:grid-cols-2">
        <WidgetCard title={t("sectionsTitle")}>
          {data.sections.length === 0 ? (
            <Empty>{t("sectionsEmpty")}</Empty>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.sections.map((section) => {
                const Icon = STATUS_ICON[section.status]
                return (
                  <li
                    key={section.sectionId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {t("sectionName", {
                          className: section.className,
                          sectionName: section.sectionName,
                        })}
                      </span>
                      {section.holiday && (
                        <span className="truncate text-xs text-muted-foreground">
                          {section.holiday}
                        </span>
                      )}
                    </span>
                    <Badge
                      variant={
                        section.status === "pending" ? "outline" : "secondary"
                      }
                    >
                      <Icon aria-hidden />
                      {t(`status.${section.status}`)}
                    </Badge>
                    {section.status === "pending" && (
                      <Link
                        href={takeAttendanceHref(section.sectionId)}
                        className={buttonVariants({ size: "sm" })}
                      >
                        {t("takeAttendance")}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </WidgetCard>

        <WidgetCard title={t("marksTitle")}>
          {data.pendingMarkSheets.length === 0 ? (
            <Empty>{t("marksEmpty")}</Empty>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.pendingMarkSheets.map((sheet) => (
                <li
                  key={sheet.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {sheet.subjectName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {sheet.sectionName}
                    </span>
                  </span>
                  <Link
                    href={enterMarksHref(sheet.id)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    {t("enterMarks")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>
    </div>
  )
}
