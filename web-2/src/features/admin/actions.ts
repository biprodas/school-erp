"use server"

import { redirect } from "next/navigation"

import { loginSchema } from "~/features/auth/schemas"
import { backendFetch } from "~/lib/api/server"
import {
  errorState,
  invalidState,
  type FormState,
} from "~/lib/forms/form-state"
import { getRequestHost } from "~/lib/request-host"
import { adminDestination } from "~/lib/session/home"
import type { TokenResponse } from "~/lib/session/tokens"

import { PLATFORM_ADMIN_REQUIRED, startPlatformSession } from "./session"

const text = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

/**
 * `POST /platform/auth/login` on the admin host, then into the
 * `school_erp_admin` cookie. Only platform admins get in.
 */
export async function platformSignIn(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if ((await getRequestHost()).kind !== "admin") {
    return { status: "error", code: "UNKNOWN" }
  }
  const parsed = loginSchema.safeParse({
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
