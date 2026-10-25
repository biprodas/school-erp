"use client"

import { useQuery } from "@tanstack/react-query"
import { BanknoteIcon, ReceiptIcon, WalletIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  accountantDashboardQuery,
  type AccountantDashboard,
} from "~/features/dashboard/api"
import { Badge } from "~/components/ui/badge"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import { Empty } from "./school-overview"
import { StatGrid, StatTile } from "./stat-tile"
import { GroupSkeleton, WidgetCard, WidgetGroup } from "./widget-group"

/** `dashboard_accountant:read`: money in, money owed, money out. */
export function Finance() {
  const t = useTranslations("dashboard.finance")
  const f = useSchoolFormat()
  const query = useQuery(accountantDashboardQuery())

  return (
    <WidgetGroup
      id="finance"
      title={t("title")}
      description={(data) => t("description", { date: f.date(data.date) })}
      query={query}
      skeleton={<GroupSkeleton tiles={4} cards={1} />}
    >
      {(data) => <Money data={data} />}
    </WidgetGroup>
  )
}

function Money({ data }: { data: AccountantDashboard }) {
  const t = useTranslations("dashboard")
  const f = useSchoolFormat()

  return (
    <div className="flex flex-col gap-3">
      <StatGrid wide>
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
          icon={<ReceiptIcon />}
          label={t("tiles.expensesMonth")}
          value={f.moneyShort(data.expenses.monthToDate)}
        />
      </StatGrid>

      <WidgetCard title={t("finance.recentTitle")}>
        {data.recentPayments.length === 0 ? (
          <Empty>{t("finance.recentEmpty")}</Empty>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.recentPayments.map((payment) => {
              const reversed = payment.status === "reversed"
              return (
                <li
                  key={payment.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {payment.payer || t("finance.unknownPayer")}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t(`finance.channels.${payment.channel}`)} ·{" "}
                      {f.dateTime(payment.receivedAt)}
                    </span>
                  </span>
                  {reversed && (
                    <Badge variant="outline">{t("finance.reversed")}</Badge>
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      reversed && "text-muted-foreground line-through"
                    )}
                  >
                    {f.money(payment.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </WidgetCard>
    </div>
  )
}
