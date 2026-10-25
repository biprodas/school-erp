"use server"

import { redirect } from "next/navigation"

import { isApiError } from "~/lib/api/errors"
import { backendFetch } from "~/lib/api/server"
import {
  errorState,
  invalidState,
  type FieldMessage,
  type FormState,
} from "~/lib/forms/form-state"
import { urlOnHost } from "~/lib/hosts"
import { publicEnv } from "~/lib/public-env"
import { getRequestHost } from "~/lib/request-host"

import {
  findSchoolSchema,
  schoolAddressSchema,
  signupSchema,
  slug as slugSchema,
} from "./schemas"

// Signup and "Find your school" on the marketing site (apex). Public
// endpoints, so there is no session: the actions call the backend, and a
// finished signup goes on to the new school's host with a handoff code.

const text = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

/** Backend slug refusals → the slug field's message. */
const SLUG_ERRORS: Record<string, FieldMessage> = {
  SLUG_TAKEN: "slugTaken",
  SLUG_RESERVED: "slugReserved",
  SLUG_INVALID: "slugInvalid",
}

/** Only the apex runs these; anywhere else they don't exist. */
async function requireSite() {
  const { kind } = await getRequestHost()
  if (kind !== "site") throw new Error("Not available on this host")
}

/** A slug refusal shown on the slug field, with its suggestions. */
function slugState(error: unknown): FormState {
  const state = errorState(error)
  if (state.status !== "error" || !Object.hasOwn(SLUG_ERRORS, state.code))
    return state
  return { ...state, fieldErrors: { slug: SLUG_ERRORS[state.code] } }
}

type SignupAnswer =
  | { status: "verification_sent"; email: string }
  | { status: "created"; redirectUrl: string }

/**
 * `POST /public/signup`. Answers "check your email" (also for an email
 * that already has an account); with a Google ticket the school is
 * created at once and the owner moves to it, signed in.
 */
export async function startSignup(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSite()
  const parsed = signupSchema.safeParse({
    schoolName: text(formData, "schoolName"),
    type: text(formData, "type"),
    slug: text(formData, "slug"),
    ownerName: text(formData, "ownerName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    password: text(formData, "password"),
    googleTicket: text(formData, "googleTicket"),
  })
  if (!parsed.success) return invalidState(parsed.error)
  const { phone, password, googleTicket, ...rest } = parsed.data

  let answer: SignupAnswer
  try {
    answer = await backendFetch<SignupAnswer>("/public/signup", {
      method: "POST",
      session: null,
      body: {
        ...rest,
        ...(phone && { phone }),
        ...(googleTicket ? { googleTicket } : { password }),
      },
    })
  } catch (error) {
    return slugState(error)
  }
  if (answer.status === "created") redirect(answer.redirectUrl)
  return { status: "success", email: answer.email }
}

/**
 * `POST /public/signup/verify`: the emailed link creates the school and
 * signs the owner in on its host. `slug` is a new address when the one
 * asked for was taken in the meantime.
 */
export async function verifySignup(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSite()
  const newSlug = text(formData, "slug")
  let slug: string | undefined
  if (newSlug) {
    const parsed = slugSchema.safeParse(newSlug)
    if (!parsed.success) {
      return invalidState({
        issues: parsed.error.issues.map((i) => ({ ...i, path: ["slug"] })),
      })
    }
    slug = parsed.data
  }

  let redirectUrl: string
  try {
    ;({ redirectUrl } = await backendFetch<{ redirectUrl: string }>(
      "/public/signup/verify",
      {
        method: "POST",
        session: null,
        body: { token: text(formData, "token"), ...(slug && { slug }) },
      }
    ))
  } catch (error) {
    return slugState(error)
  }
  redirect(redirectUrl)
}

/**
 * `POST /public/find-school`: emails sign-in links to every school of the
 * account. The answer never says whether the email has one.
 */
export async function findSchoolByEmail(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSite()
  const parsed = findSchoolSchema.safeParse({ email: text(formData, "email") })
  if (!parsed.success) return invalidState(parsed.error)

  try {
    await backendFetch("/public/find-school", {
      method: "POST",
      session: null,
      body: parsed.data,
    })
  } catch (error) {
    // Throttling and outages are shown; nothing else can come back here.
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
 * "Enter your school's address": looks the slug up (`GET
 * /public/organizations/by-slug`, which follows renames) and goes to that
 * school's sign-in page.
 */
export async function goToSchool(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSite()
  const parsed = schoolAddressSchema(publicEnv.rootDomain).safeParse({
    address: text(formData, "address"),
  })
  if (!parsed.success) return invalidState(parsed.error)

  let school: { slug: string }
  try {
    school = await backendFetch<{ slug: string }>(
      "/public/organizations/by-slug",
      { query: { slug: parsed.data.address }, session: null }
    )
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return {
        status: "error",
        code: "NOT_FOUND",
        fieldErrors: { address: "noSchoolAtAddress" },
      }
    }
    return errorState(error)
  }
  const { origin } = await getRequestHost()
  redirect(
    urlOnHost(origin, `${school.slug}.${publicEnv.rootDomain}`, "/login")
  )
}
