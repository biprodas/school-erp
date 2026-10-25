"use server"

import { redirect } from "next/navigation"

import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"
import {
  errorState,
  invalidState,
  type FormState,
} from "~/lib/forms/form-state"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"
import { clearSession, getSession, setSession } from "~/lib/auth"
import { destinationAfterSignIn, homeFor } from "~/lib/auth/home"
import { withAccessToken, type TokenResponse } from "~/lib/auth/tokens"

import {
  activateExistingSchema,
  activateNewSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "./schemas"
import { onboardingCompletedAt, startSession } from "./session"

// Sign-in steps on a school host (doc/frontend-implementation-plan.md
// 4.2). Tokens stay on the server: each action calls the backend, keeps
// the answer in the sealed session cookie and redirects. Failures come
// back as `FormState` for the form to show. `redirect()` throws, so it is
// always called outside the `try`.

const text = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

/** `POST /auth/login` with an email or phone and the password. */
export async function signIn(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSchoolSlug()
  const parsed = loginSchema.safeParse({
    identifier: text(formData, "identifier"),
    password: text(formData, "password"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  let destination: string
  try {
    const tokens = await backendFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: parsed.data,
      session: null,
    })
    const session = await startSession(tokens)
    destination = destinationAfterSignIn(session, text(formData, "next"))
  } catch (error) {
    return errorState(error)
  }
  redirect(destination)
}

/**
 * `POST /auth/activate`: a new account chooses its password; one that
 * already has its own confirms it (the backend never replaces it).
 */
export async function activate(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSchoolSlug()
  const token = text(formData, "token")
  const schema =
    text(formData, "mode") === "existing"
      ? activateExistingSchema
      : activateNewSchema
  const parsed = schema.safeParse({
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  let destination: string
  try {
    const tokens = await backendFetch<TokenResponse>("/auth/activate", {
      method: "POST",
      body: { token, password: parsed.data.password },
      session: null,
    })
    destination = homeFor(await startSession(tokens))
  } catch (error) {
    return errorState(error)
  }
  redirect(destination)
}

/**
 * `POST /auth/forgot-password`. The backend answers the same whether or
 * not the email belongs to a member, and so does this.
 */
export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSchoolSlug()
  const parsed = forgotPasswordSchema.safeParse({
    email: text(formData, "email"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  try {
    await backendFetch("/auth/forgot-password", {
      method: "POST",
      body: parsed.data,
      session: null,
    })
  } catch (error) {
    // Throttling and outages are shown; any other refusal reads as "sent",
    // so the page never says whether the email has an account.
    const silent =
      isApiError(error) &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 429
    if (!silent) return errorState(error)
  }
  return { status: "success", email: parsed.data.email }
}

/**
 * `POST /auth/reset-password`. The backend ends every session of the
 * account, so this host's cookie goes too; the user signs in again.
 */
export async function resetPassword(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSchoolSlug()
  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  try {
    await backendFetch("/auth/reset-password", {
      method: "POST",
      body: { token: text(formData, "token"), password: parsed.data.password },
      session: null,
    })
  } catch (error) {
    return errorState(error)
  }
  await clearSession()
  redirect("/login?notice=password-reset")
}

/** `POST /auth/verify-email`, from the button on `/verify-email`. */
export async function verifyEmail(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSchoolSlug()
  try {
    const result = await backendFetch<{ email: string | null }>(
      "/auth/verify-email",
      {
        method: "POST",
        body: { token: text(formData, "token") },
        session: null,
      }
    )
    return { status: "success", email: result.email }
  } catch (error) {
    return errorState(error)
  }
}

/**
 * `POST /auth/change-password`, forced (a temporary password) or by
 * choice. Other sessions of the account end; this one continues with the
 * new access token, which also lifts the forced change.
 */
export async function changePassword(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login?next=/change-password")

  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  let destination: string
  try {
    const { access_token } = await backendFetch<{ access_token: string }>(
      "/auth/change-password",
      {
        method: "POST",
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.password,
        },
        session,
      }
    )
    const next = {
      ...withAccessToken(session, access_token),
      mustChangePassword: false,
    }
    await setSession(next)
    destination = destinationAfterSignIn(next, text(formData, "next"))
  } catch (error) {
    if (isApiError(error) && error.code === "WRONG_PASSWORD") {
      return {
        status: "error",
        code: error.code,
        fieldErrors: { currentPassword: "wrongPassword" },
      }
    }
    if (isApiError(error) && error.status === 401) {
      await clearSession()
      redirect("/login?next=/change-password")
    }
    return errorState(error)
  }
  redirect(destination)
}

/**
 * "Check again" on `/setting-up`: reads whether onboarding is done now and
 * moves on when it is.
 */
export async function recheckOnboarding(): Promise<FormState> {
  await requireSchoolSlug()
  const session = await getSession()
  if (!session) redirect("/login")

  const completedAt = await onboardingCompletedAt(session)
  if (!completedAt) return { status: "error", code: "ONBOARDING_OPEN" }
  const next = { ...session, onboardingCompletedAt: completedAt }
  await setSession(next)
  redirect(homeFor(next))
}
