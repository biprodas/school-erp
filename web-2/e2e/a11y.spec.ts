import { onHost } from "./support/env"
import {
  createSchool,
  firstSignIn,
  inviteByPhone,
  openSchool,
  ownerPage,
  settle,
} from "./support/school"
import { expect, expectAccessible, test } from "./support/test"

// M9: axe (WCAG 2.1 AA, light and dark) on every page of this slice that
// the flow specs don't already check: signup, check-email, verify,
// onboarding, dashboard, change-password, activation, the portal and the
// admin pages are checked where those flows pass through them.

test("public pages", async ({ page }) => {
  const school = await createSchool("a11y-public")
  const pages = [
    onHost(null, "/"),
    onHost(null, "/find-school"),
    onHost(null, "/find-school/email"),
    onHost(null, "/signup/verify?token=not-a-token"),
    onHost("no-such-school-here", "/"),
    school.url("/"),
    school.url("/login"),
    school.url("/forgot-password"),
    school.url("/reset-password?token=not-a-token"),
    school.url("/activate?token=not-a-token"),
    school.url("/verify-email?token=not-a-token"),
  ]
  for (const url of pages) {
    await page.goto(url)
    await settle(page)
    await expect(page.locator("main, [role=main]").first()).toBeVisible()
    await expectAccessible(page)
  }
})

test("staff app pages and the wait for setup", async ({ page, browser }) => {
  const school = await createSchool("a11y-staff")
  await ownerPage(page, school)

  // Staff wait on /setting-up while the school is being set up.
  const invite = await inviteByPhone(page, "Rina Teacher", "teacher")
  const context = await browser.newContext()
  const teacher = await context.newPage()
  await firstSignIn(
    teacher,
    school.origin,
    invite.phone,
    invite.temporaryPassword
  )
  await expect(teacher).toHaveURL(/\/setting-up$/)
  await expectAccessible(teacher)
  await context.close()

  await openSchool(page, school)
  for (const path of [
    "/dashboard",
    "/dashboard/account",
    "/dashboard/students",
    "/dashboard/no-such-page",
  ]) {
    await page.goto(school.url(path))
    await settle(page)
    await expectAccessible(page)
  }
})
