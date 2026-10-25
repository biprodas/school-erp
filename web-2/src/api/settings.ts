import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"
import type { DateFormat, Numerals } from "~/lib/format"

/** `GET /settings/display` (SettingsService.getDisplay), for every member. */
export interface DisplaySettings {
  name: string
  nameBn: string | null
  /** Signed, short-lived URL. */
  logoUrl: string | null
  /** `#rrggbb` or null. */
  colors: { primary: string | null; secondary: string | null }
  locale: {
    language: "bn" | "en"
    dateFormat: DateFormat
    numerals: Numerals
    currency: string
    timeZone: string
    weekStart: string
    weekendDays: string[]
  }
}

export const settingsKeys = {
  display: ["settings", "display"] as const,
}

/** Kept for 5 minutes: the logo URL is signed and names rarely change. */
export const displaySettingsQuery = () =>
  queryOptions({
    queryKey: settingsKeys.display,
    queryFn: ({ signal }) =>
      apiFetch<DisplaySettings>("/settings/display", { signal }),
    staleTime: 5 * 60_000,
  })

/** The school's name in the viewer's language. */
export const displayName = (settings: DisplaySettings, locale: string) =>
  (locale === "bn" && settings.nameBn) || settings.name
