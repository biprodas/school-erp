"use client"

import { useQuery } from "@tanstack/react-query"
import {
  CalendarCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClockIcon,
  PinIcon,
  PlaneIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  childDashboardQuery,
  childName,
  type ChildDashboard,
  type CountsAs,
} from "~/features/portal/api"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Skeleton } from "~/components/ui/skeleton"
import { StatGrid, StatTile } from "~/features/dashboard/components/stat-tile"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import { useSelectedChild } from "../use-selected-child"

const STATUS_ICONS: Record<CountsAs, React.ReactNode> = {
  present: <CircleCheckIcon />,
  absent: <CircleXIcon />,
  late: <ClockIcon />,
  leave: <PlaneIcon />,
  half_day: <CircleDashedIcon />,
}

/**
 * `/student`: the selected child's day at a glance (`GET
 * /portal/children/:id/dashboard`): today's attendance, the session so
 * far, dues, upcoming exams and the latest notices.
 */
export function ChildHome() {
  const t = useTranslations("portal")
  const { children, child } = useSelectedChild()

  if (children.isPending) return <HomeSkeleton />
  if (children.isError) return <LoadFailed retry={children.refetch} />
  if (!child) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="font-display text-xl font-semibold">
              {t("noChildrenTitle")}
            </h1>
          </EmptyTitle>
          <EmptyDescription>{t("noChildrenBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  // Keyed: another child starts from their own loading state.
  return <ChildSummary key={child.studentId} studentId={child.studentId} />
}

function ChildSummary({ studentId }: { studentId: string }) {
  const dashboard = useQuery(childDashboardQuery(studentId))
  if (dashboard.isPending) return <HomeSkeleton />
  if (dashboard.isError) return <LoadFailed retry={dashboard.refetch} />
  return <Summary data={dashboard.data} />
}

function Summary({ data }: { data: ChildDashboard }) {
  const t = useTranslations("portal.home")
  const locale = useLocale()
  const f = useSchoolFormat()
  const { child, attendance, dues } = data
  const today = attendance.today
  const session = attendance.session

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {childName(child, locale)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {[
            t("admissionNumber", { number: child.admissionNumber }),
            child.enrollment?.rollNo &&
              t("roll", { roll: child.enrollment.rollNo }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <StatGrid>
        <StatTile
          label={t("today")}
          icon={today ? STATUS_ICONS[today.countsAs] : <CalendarCheckIcon />}
          value={
            today
              ? locale === "bn"
                ? today.labelBn
                : today.label
              : t("notTaken")
          }
          hint={today ? undefined : t("notTakenHint")}
        />
        <StatTile
          label={t("sessionAttendance")}
          icon={<CalendarCheckIcon />}
          value={
            session?.percentage != null
              ? f.percent(session.percentage)
              : t("noRecords")
          }
          hint={
            session && session.days > 0
              ? t("daysPresent", {
                  count: session.days,
                  present: f.number(session.present + session.late),
                  days: f.number(session.days),
                })
              : undefined
          }
        />
        <StatTile
          label={t("dues")}
          icon={<WalletIcon />}
          value={
            dues.outstanding > 0 ? f.moneyShort(dues.outstanding) : t("noDues")
          }
          hint={
            dues.nextDueDate && dues.nextDueAmount > 0
              ? t("nextDue", {
                  amount: f.moneyShort(dues.nextDueAmount),
                  date: f.date(dues.nextDueDate),
                })
              : undefined
          }
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>{t("examsTitle")}</h2>
            </CardTitle>
            <CardDescription>{t("examsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingExams.length ? (
              <ul className="flex flex-col divide-y">
                {data.upcomingExams.map((exam) => (
                  <li
                    key={exam.id}
                    className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="font-medium">{exam.name}</span>
                    {exam.startDate && (
                      <span className="text-sm text-muted-foreground">
                        {exam.endDate && exam.endDate !== exam.startDate
                          ? t("dateRange", {
                              start: f.date(exam.startDate),
                              end: f.date(exam.endDate),
                            })
                          : f.date(exam.startDate)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noExams")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>{t("noticesTitle")}</h2>
            </CardTitle>
            <CardDescription>{t("noticesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.notices.length ? (
              <ul className="flex flex-col divide-y">
                {data.notices.map((notice) => (
                  <li
                    key={notice.id}
                    className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          notice.read ? "font-normal" : "font-semibold"
                        }
                      >
                        {notice.title}
                      </span>
                      {notice.pinned && (
                        <Badge variant="secondary">
                          <PinIcon aria-hidden />
                          {t("pinned")}
                        </Badge>
                      )}
                      {!notice.read && (
                        <span className="sr-only">{t("unread")}</span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {notice.body}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {f.date(notice.publishAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noNotices")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

function LoadFailed({ retry }: { retry: () => unknown }) {
  const t = useTranslations("portal")
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertDescription className="flex flex-col items-start gap-2">
        {t("loadFailed")}
        <Button variant="outline" size="sm" onClick={() => void retry()}>
          {t("retry")}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
