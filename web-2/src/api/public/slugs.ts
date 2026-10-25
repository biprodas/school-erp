import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

/** `GET /public/slugs/check` (SlugService.check). */
export interface SlugCheck {
  slug: string
  available: boolean
  reason?: "invalid" | "reserved" | "taken"
  /** Up to three free alternatives when this one isn't. */
  suggestions: string[]
}

/**
 * Whether a school address is free, through the BFF. The backend allows
 * about ten checks a minute per address, so callers debounce, and answers
 * are kept for 30 s.
 */
export const slugCheckQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public", "slug-check", slug],
    queryFn: ({ signal }) =>
      apiFetch<SlugCheck>("/public/slugs/check", { query: { slug }, signal }),
    staleTime: 30_000,
    retry: false,
  })
