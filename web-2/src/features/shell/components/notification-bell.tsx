"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFormatter, useNow, useTranslations } from "next-intl"
import { useState } from "react"

import {
  latestNotificationsQuery,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  unreadCountQuery,
  type Notification,
} from "~/features/notifications/api"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Spinner } from "~/components/ui/spinner"
import { safeNext } from "~/lib/security/safe-next"
import { cn } from "~/lib/utils"

/** Badges stop counting here. */
const MAX_BADGE = 99

/**
 * The bell: unread count (polled every minute and on focus), and the
 * latest notifications when opened. Choosing one marks it read and opens
 * its link when it points into the staff app.
 */
export function NotificationBell() {
  const t = useTranslations("shell.notifications")
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const unread = useQuery(unreadCountQuery())
  const latest = useQuery({ ...latestNotificationsQuery(), enabled: open })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSettled: refresh,
  })
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSettled: refresh,
  })

  const count = unread.data ?? 0
  const items = latest.data?.items ?? []

  function choose(notification: Notification) {
    if (!notification.readAt) readOne.mutate(notification.id)
    const link = safeNext(notification.link, "")
    if (link === "/dashboard" || link.startsWith("/dashboard/")) {
      router.push(link)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={count > 0 ? t("labelUnread", { count }) : t("label")}
          />
        }
      >
        <BellIcon />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] leading-none font-semibold text-white tabular-nums"
          >
            {count > MAX_BADGE ? `${MAX_BADGE}+` : format.number(count)}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2 px-1.5 py-1">
            <DropdownMenuLabel className="p-0 text-sm text-foreground">
              {t("title")}
            </DropdownMenuLabel>
            <Button
              variant="ghost"
              size="xs"
              disabled={count === 0 || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              {readAll.isPending ? <Spinner /> : <CheckCheckIcon />}
              {t("markAllRead")}
            </Button>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {latest.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : latest.isError ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("loadFailed")}
          </p>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <DropdownMenuGroup>
            {items.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => choose(notification)}
                className="items-start gap-2.5 py-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    notification.readAt ? "bg-transparent" : "bg-primary"
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      "line-clamp-1",
                      !notification.readAt && "font-medium"
                    )}
                  >
                    {notification.title}
                    {!notification.readAt && (
                      <span className="sr-only"> ({t("unread")})</span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {notification.body}
                  </span>
                  <time
                    dateTime={notification.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {format.relativeTime(new Date(notification.createdAt), now)}
                  </time>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
