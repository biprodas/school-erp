import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

/** `GET /auth/me` (AuthService.getMe): the signed-in member of this school. */
export interface Me {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  status: string
  isAdmin: boolean
  membershipId: string
  /** Role names, for display only; gate on `permissions`. */
  roles: string[]
  /** Effective permission keys (the whole catalog for school admins). */
  permissions: string[]
  identities: Identity[]
  organization: {
    id: string
    slug: string
    name: string | null
    status: "trial" | "active" | "past_due" | null
    onboardingCompletedAt: string | null
  }
  plan: {
    code: string
    effectiveCode: string
    onTrial: boolean
    trialEndsAt: string | null
    modules: string[]
    limits: Record<string, number | null>
  }
}

export interface Identity {
  provider: "google"
  email: string | null
  linkedAt: string
  lastUsedAt: string | null
}

/** `GET /auth/sessions`: active sign-ins at this school, newest first. */
export interface AccountSession {
  id: string
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastUsedAt: string | null
  current: boolean
}

/** `GET /auth/schools`: the user's other schools, for the switcher. */
export interface OtherSchool {
  orgId: string
  slug: string
  name: string
  host: string
  isAdmin: boolean
}

export const authKeys = {
  me: ["auth", "me"] as const,
  sessions: ["auth", "sessions"] as const,
  schools: ["auth", "schools"] as const,
}

/**
 * The member, refetched whenever the window regains focus (not only when
 * stale), so a permission taken away shows up in the menus right away.
 */
export const meQuery = () =>
  queryOptions({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => apiFetch<Me>("/auth/me", { signal }),
    refetchOnWindowFocus: "always",
  })

export const sessionsQuery = () =>
  queryOptions({
    queryKey: authKeys.sessions,
    queryFn: ({ signal }) =>
      apiFetch<AccountSession[]>("/auth/sessions", { signal }),
  })

export const otherSchoolsQuery = () =>
  queryOptions({
    queryKey: authKeys.schools,
    queryFn: ({ signal }) =>
      apiFetch<OtherSchool[]>("/auth/schools", { signal }),
    staleTime: 5 * 60_000,
  })

export const endSession = (id: string) =>
  apiFetch<void>(`/auth/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

/** A one-time sign-in code for another school; open `redirectUrl`. */
export const switchSchool = (orgId: string) =>
  apiFetch<{ redirectUrl: string }>("/auth/schools/handoff", {
    method: "POST",
    body: { orgId },
  })

/** The Google URL that links an account; it comes back to `next`. */
export const startGoogleLink = (returnHost: string, next: string) =>
  apiFetch<{ url: string }>("/auth/identities/google/link", {
    method: "POST",
    body: { returnHost, next },
  })

export const unlinkGoogle = () =>
  apiFetch<void>("/auth/identities/google", { method: "DELETE" })
