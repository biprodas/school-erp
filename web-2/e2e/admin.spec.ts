import { adminUrl, E2E } from "./support/env"
import { createSchool, settle } from "./support/school"
import { expect, expectAccessible, test } from "./support/test"

// M8: the platform console on the admin host, for platform admins only.

async function signInHere(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.getByLabel("Email or phone").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test("a school account is refused; the super-admin signs in and out", async ({
  page,
}) => {
  const school = await createSchool("admin")
  await page.goto(adminUrl("/"))
  await expect(page).toHaveURL(adminUrl("/login?next=%2F"))
  await settle(page)
  await expectAccessible(page)
  await expect(page.getByText("Forgot password?")).toHaveCount(0)

  await signInHere(page, school.owner.email, school.owner.password)
  await expect(page.getByText(/can't open the platform console/)).toBeVisible()
  const cookies = async () =>
    (await page.context().cookies(adminUrl())).map((c) => c.name)
  expect(await cookies()).not.toContain("school_erp_admin")

  await signInHere(page, E2E.admin.email, E2E.admin.password)
  await page.waitForURL(adminUrl("/"))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Welcome, /)
  expect(await cookies()).toContain("school_erp_admin")
  await expectAccessible(page)

  await page.goto(adminUrl("/login"))
  await expect(page).toHaveURL(adminUrl("/"))
  await settle(page)

  await page.getByRole("button", { name: /Account menu for/ }).click()
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click()
  await page.waitForURL(adminUrl("/login"))
  await page.goto(adminUrl("/"))
  await expect(page).toHaveURL(/\/login/)
})
