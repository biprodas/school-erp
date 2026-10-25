import { linkFromMail } from "./support/mail"
import {
  bff,
  createSchool,
  firstSignIn,
  inviteByPhone,
  MEMBER_PASSWORD,
  openSchool,
  ownerPage,
  roleId,
  settle,
} from "./support/school"
import { expect, expectAccessible, test } from "./support/test"

// Section 9: activation from an invite email, a forced password change,
// and what a teacher sees next to an admin.

test("an invited teacher activates from the email and lands on the dashboard", async ({
  page,
  browser,
}) => {
  const school = await createSchool("invite")
  await ownerPage(page, school)
  await openSchool(page, school)
  const email = `teacher-${school.slug}@example.test`
  await bff(page, "/users/invite", {
    method: "POST",
    body: {
      name: "Rina Teacher",
      email,
      roleIds: [await roleId(page, "teacher")],
    },
  })

  const link = await linkFromMail(
    email,
    /href="([^"]*\/activate\?token=[^"]+)"/
  )
  const context = await browser.newContext()
  const teacher = await context.newPage()
  await teacher.goto(link)
  await settle(teacher)
  await expect(
    teacher.getByRole("heading", { name: "Set up your account" })
  ).toBeVisible()
  await expectAccessible(teacher)
  await teacher.locator("#password").fill(MEMBER_PASSWORD)
  await teacher.locator("#confirmPassword").fill(MEMBER_PASSWORD)
  await teacher.getByRole("button", { name: "Activate and sign in" }).click()
  await teacher.waitForURL("**/dashboard")
  await expect(teacher.getByRole("heading", { level: 1 })).toBeVisible()

  // The link works once.
  const again = await context.newPage()
  await again.context().clearCookies()
  await again.goto(link)
  await expect(
    again.getByRole("heading", { name: "This invitation link doesn't work" })
  ).toBeVisible()
  await context.close()
})

test("a member with a temporary password must change it first", async ({
  page,
  browser,
}) => {
  const school = await createSchool("forced")
  await ownerPage(page, school)
  await openSchool(page, school)
  const invite = await inviteByPhone(page, "Karim Accountant", "accountant")

  const context = await browser.newContext()
  const member = await context.newPage()
  await member.goto(school.url("/login"))
  await settle(member)
  await member.getByLabel("Email or phone").fill(invite.phone)
  await member
    .getByLabel("Password", { exact: true })
    .fill(invite.temporaryPassword)
  await member.getByRole("button", { name: "Sign in" }).click()
  await member.waitForURL("**/change-password**")
  await settle(member)
  await expectAccessible(member)

  // Nothing else opens until it is changed.
  await member.goto(school.url("/dashboard"))
  await expect(member).toHaveURL(/\/change-password/)

  await member.locator("#currentPassword").fill(invite.temporaryPassword)
  await member.locator("#password").fill(MEMBER_PASSWORD)
  await member.locator("#confirmPassword").fill(MEMBER_PASSWORD)
  await member.getByRole("button", { name: "Change password" }).click()
  await member.waitForURL("**/dashboard")
  await expect(member.getByRole("region", { name: "Finance" })).toBeVisible()
  await context.close()
})

test("a teacher sees only their menus and My day; the admin sees everything", async ({
  page,
  browser,
}, testInfo) => {
  const school = await createSchool("roles")
  await ownerPage(page, school)
  await openSchool(page, school)
  const invite = await inviteByPhone(page, "Rina Teacher", "teacher")

  const openMenu = async (p: import("@playwright/test").Page) => {
    if (testInfo.project.name === "mobile") {
      await p.getByRole("button", { name: "Show or hide the menu" }).click()
    }
    const nav = p.getByRole("navigation", { name: "Main menu" })
    await expect(nav.getByRole("link").first()).toBeVisible()
    return nav
  }

  // The admin: every category and the three dashboard groups.
  await page.reload()
  await settle(page)
  for (const group of ["My day", "School overview", "Finance"]) {
    await expect(page.getByRole("region", { name: group })).toBeVisible()
  }
  const adminNav = await openMenu(page)
  for (const category of ["Academics", "People", "Finance", "Administration"]) {
    await expect(adminNav.getByText(category, { exact: true })).toBeVisible()
  }

  const context = await browser.newContext({
    viewport: testInfo.project.use.viewport ?? undefined,
  })
  const teacher = await context.newPage()
  await firstSignIn(
    teacher,
    school.origin,
    invite.phone,
    invite.temporaryPassword
  )
  await expect(teacher).toHaveURL(/\/dashboard$/)
  await expect(teacher.getByRole("region", { name: "My day" })).toBeVisible()
  await expect(
    teacher.getByRole("region", { name: "School overview" })
  ).toHaveCount(0)
  await expect(teacher.getByRole("region", { name: "Finance" })).toHaveCount(0)
  const teacherNav = await openMenu(teacher)
  await expect(
    teacherNav.getByText("Administration", { exact: true })
  ).toHaveCount(0)
  await expect(teacherNav.getByText("Finance", { exact: true })).toHaveCount(0)
  await expectAccessible(teacher)
  await context.close()
})
