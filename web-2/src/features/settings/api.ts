import { queryOptions } from "@tanstack/react-query"

import type { SchoolType } from "~/features/onboarding/api"
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
  all: ["settings", "all"] as const,
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

/** The parts of `GET /settings` (`settings:read`) the app uses so far. */
export interface SchoolSettings {
  organization: {
    id: string
    name: string
    slug: string
    type: SchoolType
    eiin: string | null
  }
  profile: {
    nameBn: string | null
    address: {
      line1: string | null
      line2: string | null
      area: string | null
      district: string | null
      postCode: string | null
    }
    phone: string | null
    email: string | null
  }
  /** Signed, short-lived URLs. */
  files?: { logoUrl: string | null }
}

export const schoolSettingsQuery = () =>
  queryOptions({
    queryKey: settingsKeys.all,
    queryFn: ({ signal }) => apiFetch<SchoolSettings>("/settings", { signal }),
  })

export interface ProfilePatch {
  nameBn?: string | null
  address?: Partial<SchoolSettings["profile"]["address"]>
  phone?: string | null
  email?: string | null
}

/** `PATCH /settings/organization`: the school's own fields on `organizations`. */
export const updateOrganizationSettings = (body: {
  name?: string
  type?: SchoolType
  /** Digits only; null clears it. */
  eiin?: string | null
}) => apiFetch<unknown>("/settings/organization", { method: "PATCH", body })

/** PNG, JPEG or WebP, up to 2 MB (`org_logo` on the backend). */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

/** `POST /settings/files/logo`: replaces the school logo. */
export const uploadLogo = (file: File) => {
  const body = new FormData()
  body.append("file", file)
  return apiFetch<{ fileId: string; url: string }>("/settings/files/logo", {
    method: "POST",
    body,
  })
}

/** `PATCH /settings/profile`: only the fields given; `address` merges. */
export const updateProfileSettings = (body: ProfilePatch) =>
  apiFetch<unknown>("/settings/profile", { method: "PATCH", body })
