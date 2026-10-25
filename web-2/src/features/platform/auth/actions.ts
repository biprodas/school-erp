"use server"

import { redirect } from "next/navigation"

import {
  forgotPasswordSchema,
  platformLoginSchema,
  resetPasswordSchema,
} from "~/features/auth/schemas"
import { clearSession } from "~/lib/auth"
import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"
import {
  errorState,
  invalidState,
  type FormState,
} from "~/lib/forms/form-state"
import { getRequestHost } from "~/lib/tenancy/request-host"
import { adminDestination } from "~/lib/auth/home"
import type { TokenResponse } from "~/lib/auth/tokens"

import { PLATFORM_ADMIN_REQUIRED, startPlatformSession } from "./server/session"

const text = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

/**
 * `POST /platform/auth/login` on the admin host, then into the
 * `school_erp_admin` cookie. Only platform staff (a console role) get in.
 */
export async function platformSignIn(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if ((await getRequestHost()).kind !== "admin") {
    return { status: "error", code: "UNKNOWN" }
  }
  const parsed = platformLoginSchema.safeParse({
    identifier: text(formData, "identifier"),
    password: text(formData, "password"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  try {
    const tokens = await backendFetch<TokenResponse>("/platform/auth/login", {
      method: "POST",
      body: parsed.data,
      session: null,
    })
    if (!(await startPlatformSession(tokens))) {
      return { status: "error", code: PLATFORM_ADMIN_REQUIRED }
    }
  } catch (error) {
    return errorState(error)
  }
  redirect(adminDestination(text(formData, "next")))
}

/**
 * `POST /platform/auth/forgot-password` on the admin host. Like the school
 * form, any refusal but throttling reads as "sent", so the page never says
 * whether the email has an account.
 */
export async function platformRequestPasswordReset(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if ((await getRequestHost()).kind !== "admin") {
    return { status: "error", code: "UNKNOWN" }
  }
  const parsed = forgotPasswordSchema.safeParse({
    email: text(formData, "email"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  try {
    await backendFetch("/platform/auth/forgot-password", {
      method: "POST",
      body: parsed.data,
      session: null,
    })
  } catch (error) {
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
 * `POST /platform/auth/reset-password`. The backend ends every session of
 * the account, so the admin cookie goes too; the admin signs in again.
 */
export async function platformResetPassword(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if ((await getRequestHost()).kind !== "admin") {
    return { status: "error", code: "UNKNOWN" }
  }
  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  try {
    await backendFetch("/platform/auth/reset-password", {
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
