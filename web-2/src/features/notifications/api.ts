import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

/** One in-app notification (`GET /notifications`). */
export interface Notification {
  id: string
  type: string
  title: string
  body: string
  /** Frontend path to open, when there is one. */
  link: string | null
  readAt: string | null
  createdAt: string
}

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: ["notifications", "unread-count"] as const,
  latest: ["notifications", "latest"] as const,
}

/** Polled every minute, and on focus. */
export const unreadCountQuery = () =>
  queryOptions({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) =>
      apiFetch<{ unread: number }>("/notifications/unread-count", { signal }),
    select: (data) => data.unread,
    refetchInterval: 60_000,
    staleTime: 0,
  })

export const LATEST_LIMIT = 8

export const latestNotificationsQuery = () =>
  queryOptions({
    queryKey: notificationKeys.latest,
    queryFn: ({ signal }) =>
      apiFetchPage<Notification>("/notifications", {
        query: { limit: LATEST_LIMIT },
        signal,
      }),
    staleTime: 0,
  })

export const markNotificationRead = (id: string) =>
  apiFetch<void>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  })

export const markAllNotificationsRead = () =>
  apiFetch<{ updated: number }>("/notifications/read-all", { method: "POST" })
