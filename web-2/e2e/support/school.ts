import { expect, type Page } from "@playwright/test"

import { E2E, onHost, today, uniqueId } from "./env"
import { linkFromMail } from "./mail"

export const OWNER_PASSWORD = "Owner-pass-123"
export const MEMBER_PASSWORD = "Member-pass-123"

export interface School {
  slug: string
  name: string
  origin: string
  owner: { email: string; phone: string; password: string }
  /** Signs the owner in on the school's host (from signup verification). */
  handoffUrl: string
  url: (path?: string) => string
}

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as {
    data?: T
  } | null
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`)
  }
  return (body?.data ?? body) as T
}

let phoneSeq = 0
/** A Bangladeshi mobile number no other test uses. */
export const uniquePhone = () =>
  `+88017${String(Date.now() + process.pid * 7 + phoneSeq++).slice(-8)}`

/**
 * A new school made through signup over the API, verified through the
 * Mailpit email (the UI path has its own test).
 */
export async function createSchool(
  label = "e2e",
  type = "school"
): Promise<School> {
  const slug = uniqueId(label).toLowerCase()
  const owner = {
    email: `owner-${slug}@example.test`,
    phone: uniquePhone(),
    password: OWNER_PASSWORD,
  }
  const name = `E2E ${slug}`
  await json(
    await fetch(`${E2E.api}/public/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schoolName: name,
        type,
        slug,
        ownerName: "Owner Rahman",
        email: owner.email,
        phone: owner.phone,
        password: owner.password,
      }),
    })
  )
  const token = await linkFromMail(
    owner.email,
    /signup\/verify\?token=([A-Za-z0-9_-]+)/
  )
  const { redirectUrl } = await json<{ redirectUrl: string }>(
    await fetch(`${E2E.api}/public/signup/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
  )
  const origin = onHost(slug, "").replace(/\/$/, "")
  return {
    slug,
    name,
    origin,
    owner,
    handoffUrl: redirectUrl,
    url: (path = "/") => `${origin}${path}`,
  }
}

/** Calls the BFF from inside the page, as its signed-in user. */
export async function bff<T = unknown>(
  page: Page,
  path: string,
  init: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  const out = await page.evaluate(
    async ({ path, init }) => {
      const response = await fetch(`/api${path}`, {
        method: init.method ?? "GET",
        headers: {
          "x-requested-with": "kampasy",
          accept: "application/json",
          ...(init.body !== undefined
            ? { "content-type": "application/json" }
            : {}),
          ...(init.headers ?? {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      })
      const body = await response.json().catch(() => null)
      return { status: response.status, data: body?.data ?? body }
    },
    { path, init }
  )
  if (out.status >= 300) {
    throw new Error(
      `${init.method ?? "GET"} ${path}: ${out.status} ${JSON.stringify(out.data)}`
    )
  }
  return out.data as T
}

/** Waits until requests have settled (hydration, first queries). */
export const settle = (page: Page) =>
  page.waitForLoadState("networkidle").catch(() => {})

/** The sign-in form on `origin`'s `/login`; waits to leave it. */
export async function signIn(
  page: Page,
  origin: string,
  identifier: string,
  password: string
) {
  await page.goto(`${origin}/login`)
  await settle(page)
  await page.getByLabel("Email or phone").fill(identifier)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  await settle(page)
}

/** Signs in with a slip password and sets `MEMBER_PASSWORD`. */
export async function firstSignIn(
  page: Page,
  origin: string,
  identifier: string,
  temporary: string
) {
  await signIn(page, origin, identifier, temporary)
  await expect(page).toHaveURL(/\/change-password/)
  await page.locator("#currentPassword").fill(temporary)
  await page.locator("#password").fill(MEMBER_PASSWORD)
  await page.locator("#confirmPassword").fill(MEMBER_PASSWORD)
  await page.getByRole("button", { name: "Change password" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/change-password"))
  await settle(page)
}

/** The owner, signed in on the school host through the signup handoff. */
export async function ownerPage(page: Page, school: School) {
  await page.goto(school.handoffUrl)
  await page.waitForURL(/\/onboarding/)
  await settle(page)
}

/**
 * Skips onboarding over the API and signs the owner in again, so their
 * session (which the proxy gates on) knows the school is open.
 */
export async function openSchool(page: Page, school: School) {
  await bff(page, "/onboarding/skip", { method: "POST", body: {} })
  await bff(page, "/session/logout", { method: "POST", body: {} })
  await signIn(page, school.origin, school.owner.email, school.owner.password)
  await expect(page).toHaveURL(/\/dashboard/)
}

export interface Seeded {
  yearId: string
  classes: Record<string, string>
  sections: Record<string, string>
  students: Record<string, { studentId: string; sectionId: string }>
}

/** A current session; classes with section A; students enrolled. */
export async function seedSchool(
  page: Page,
  classes: [name: string, level: number, students: [string, string][]][]
): Promise<Seeded> {
  const year = today().slice(0, 4)
  const { id: yearId } = await bff<{ id: string }>(page, "/academic-years", {
    method: "POST",
    body: {
      name: year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      isCurrent: true,
    },
  })
  const out: Seeded = { yearId, classes: {}, sections: {}, students: {} }
  for (const [className, level, students] of classes) {
    const { id: classId } = await bff<{ id: string }>(page, "/classes", {
      method: "POST",
      body: { name: className, level },
    })
    const { id: sectionId } = await bff<{ id: string }>(page, "/sections", {
      method: "POST",
      body: { academicYearId: yearId, classId, name: "A" },
    })
    out.classes[className] = classId
    out.sections[className] = sectionId
    for (const [index, [firstName, lastName]] of students.entries()) {
      const { id: studentId } = await bff<{ id: string }>(page, "/students", {
        method: "POST",
        body: { classId, firstName, lastName },
      })
      await bff(page, "/enrollments", {
        method: "POST",
        body: {
          studentId,
          academicYearId: yearId,
          classId,
          sectionId,
          rollNo: String(index + 1),
        },
      })
      out.students[`${firstName} ${lastName}`] = { studentId, sectionId }
    }
  }
  return out
}

/** The id of a system role (`teacher`, `accountant`, …). */
export async function roleId(page: Page, name: string): Promise<string> {
  const roles = await bff<{ id: string; name: string }[]>(
    page,
    "/roles?limit=100"
  )
  const role = roles.find((r) => r.name === name)
  if (!role) throw new Error(`No role ${name}`)
  return role.id
}

/** A member invited by phone, with their slip password. */
export async function inviteByPhone(
  page: Page,
  name: string,
  role: string
): Promise<{ phone: string; temporaryPassword: string }> {
  const phone = uniquePhone()
  const invite = await bff<{ temporaryPassword: string }>(
    page,
    "/users/invite",
    {
      method: "POST",
      body: { name, phone, roleIds: [await roleId(page, role)] },
    }
  )
  return { phone, temporaryPassword: invite.temporaryPassword }
}
