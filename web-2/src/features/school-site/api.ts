import "server-only"

import { notFound } from "next/navigation"
import { cache } from "react"

import { isApiError } from "~/lib/api/errors"
import { fetchPublic } from "~/lib/api/public"

/** `GET /public/organizations/:slug/home` (PublicHomeController). */
export interface SchoolHome {
  slug: string
  name: string
  nameBn: string | null
  logoUrl: string | null
  /** `#rrggbb` brand colors from the school's profile. */
  colors: { primary: string | null; secondary: string | null }
  /**
   * Off: the school has no home page (`/` goes to sign-in), and only the
   * branding fields above are sent, for the sign-in pages.
   */
  enabled: boolean
  tagline?: string | null
  taglineBn?: string | null
  /** Signed, short-lived URL. */
  heroImageUrl?: string | null
  establishedYear?: number | null
  about?: string | null
  aboutBn?: string | null
  /** Set when the school wrote a message. */
  principal?: {
    name: string | null
    photoUrl: string | null
    message: string | null
    messageBn: string | null
  } | null
  facts?: { value: string; label: string; labelBn: string | null }[]
  highlights?: {
    title: string
    titleBn: string | null
    body: string | null
    bodyBn: string | null
  }[]
  /** Set while admissions are open. */
  admission?: { note: string | null; noteBn: string | null } | null
  contact?: {
    phone: string | null
    email: string | null
    website: string | null
  } | null
  address?: {
    line1: string | null
    line2: string | null
    area: string | null
    district: string | null
    postCode: string | null
  } | null
  notices?: {
    id: string
    title: string
    body: string
    pinned: boolean
    publishAt: string | null
  }[]
}

/**
 * Deduplicated per request, so metadata and the page share one call. 404
 * when the school is gone or no longer operational (the proxy's host cache
 * can be up to a minute behind).
 */
export const getSchoolHome = cache(async (slug: string) => {
  try {
    return await fetchPublic<SchoolHome>(
      `/public/organizations/${encodeURIComponent(slug)}/home`
    )
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
})

/** The school's name in the viewer's language, falling back to the other. */
export const schoolName = (home: SchoolHome, locale: string) =>
  localized(locale, home.name, home.nameBn)

/** The Bangla text in Bangla when the school wrote one, else the English. */
export function localized(
  locale: string,
  en: string,
  bn: string | null | undefined
): string
export function localized(
  locale: string,
  en: string | null | undefined,
  bn: string | null | undefined
): string | null
export function localized(
  locale: string,
  en: string | null | undefined,
  bn: string | null | undefined
) {
  return (locale === "bn" ? bn : null) || en || bn || null
}
