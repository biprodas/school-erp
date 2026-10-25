"use server"

import { redirect } from "next/navigation"

import type { OnboardingChecklist } from "~/api/onboarding"
import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"
import { errorState, type FormState } from "~/lib/forms/form-state"
import { requireSchoolSlug } from "~/lib/request-host"
import { getSession, updateSession } from "~/lib/session"

/**
 * "Finish setup" (`POST /onboarding/complete`, every required step done)
 * or "Skip for now" (`POST /onboarding/skip`). Either way the school is
 * open: the session snapshot the proxy gates on is updated, and the admin
 * goes to `/dashboard`. Other staff see it the next time they sign in or
 * when `/setting-up` checks again.
 */
async function finish(mode: "complete" | "skip"): Promise<FormState> {
  await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login?next=/onboarding")

  let completedAt: string
  try {
    const checklist = await backendFetch<OnboardingChecklist>(
      `/onboarding/${mode}`,
      { method: "POST", body: {}, session }
    )
    completedAt = checklist.completedAt ?? new Date().toISOString()
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      redirect("/login?next=/onboarding")
    }
    return errorState(error)
  }
  await updateSession({ onboardingCompletedAt: completedAt })
  redirect("/dashboard")
}

export async function completeOnboarding(): Promise<FormState> {
  return finish("complete")
}

export async function skipOnboarding(): Promise<FormState> {
  return finish("skip")
}
