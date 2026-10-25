import {
  createSchool,
  openSchool,
  ownerPage,
  settle,
  signIn,
  type School,
} from "./support/school"
import { expect, expectAccessible, test } from "./support/test"

// Section 9: sign-in with email and with phone, the lockout message, the
// session cookie bound to its school, used handoff codes, sign-out.

const menu = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /Account menu for/ })

async function openedSchool(page: import("@playwright/test").Page) {
  const school = await createSchool("signin")
  await ownerPage(page, school)
  await openSchool(page, school)
  return school
}

async function signOut(page: import("@playwright/test").Page) {
  await menu(page).click()
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click()
  await page.waitForURL("**/login")
}

test("the owner signs in with email, then with phone", async ({ page }) => {
  const school = await openedSchool(page)
  await signOut(page)

  await signIn(page, school.origin, school.owner.email, school.owner.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await signOut(page)

  // The local form of the number works as well as +880.
  const local = `0${school.owner.phone.slice(4)}`
  await signIn(page, school.origin, local, school.owner.password)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("five wrong passwords lock the account and say until when", async ({
  page,
}) => {
  const school = await createSchool("lockout")
  await page.goto(school.url("/login"))
  await settle(page)
  await expectAccessible(page)
  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.getByLabel("Email or phone").fill(school.owner.email)
    await page.getByLabel("Password", { exact: true }).fill(`wrong-${attempt}`)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(
      page.getByRole("alert").or(page.locator("[aria-live]")).first()
    ).toBeVisible()
  }
  await expect(
    page.getByText(/Too many wrong passwords\. You can try again after .+\d/)
  ).toBeVisible()
  // The right password is refused too until then.
  await page.getByLabel("Password", { exact: true }).fill(school.owner.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText(/Too many wrong passwords/)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("[tenant-isolation] school A's session cookie is no session on school B", async ({
  page,
  browser,
}) => {
  const a = await openedSchool(page)
  const b: School = await createSchool("other")
  const cookie = (await page.context().cookies(a.origin)).find((c) =>
    c.name.endsWith("_session")
  )
  expect(cookie?.httpOnly).toBe(true)

  const other = await browser.newContext()
  await other.addCookies([
    { name: cookie!.name, value: cookie!.value, url: b.origin },
  ])
  const intruder = await other.newPage()
  await intruder.goto(b.url("/dashboard"))
  await expect(intruder).toHaveURL(/\/login\?next=%2Fdashboard/)
  await other.close()
})

test("a used handoff code ends on /login?error=handoff", async ({ page }) => {
  const school = await createSchool("handoff")
  await ownerPage(page, school)
  await page.context().clearCookies()

  await page.goto(school.handoffUrl)
  await expect(page).toHaveURL(/\/login\?error=handoff/)
  await expect(
    page.getByText("That sign-in link has expired or was already used.", {
      exact: false,
    })
  ).toBeVisible()
})

test("sign out ends this device; sign out everywhere ends the others", async ({
  page,
  browser,
}) => {
  const school = await openedSchool(page)
  const second = await browser.newContext()
  const other = await second.newPage()
  await signIn(other, school.origin, school.owner.email, school.owner.password)
  await expect(other).toHaveURL(/\/dashboard$/)

  // Plain sign-out leaves the other device signed in.
  await signOut(page)
  await other.reload()
  await expect(other).toHaveURL(/\/dashboard$/)

  await signIn(page, school.origin, school.owner.email, school.owner.password)
  await menu(page).click()
  await page.getByRole("menuitem", { name: "Sign out everywhere" }).click()
  await page.waitForURL("**/login")

  await other.goto(school.url("/dashboard/account"))
  await expect(other).toHaveURL(/\/login/)
  await second.close()
})

test("keyboard only: sign in and move through the menus", async ({
  page,
}, testInfo) => {
  const school = await createSchool("keys")
  await ownerPage(page, school)
  await openSchool(page, school)
  await signOut(page)
  await settle(page)

  // From the top of the page: the fields, then the button, by Tab alone.
  await page.locator("body").focus()
  const focused = () =>
    page.evaluate(() => document.activeElement?.getAttribute("id") ?? "")
  for (let i = 0; i < 20 && (await focused()) !== "identifier"; i++) {
    await page.keyboard.press("Tab")
  }
  expect(await focused()).toBe("identifier")
  await page.keyboard.type(school.owner.email)
  await page.keyboard.press("Tab")
  // "Forgot password?" sits in the label row before the field.
  for (let i = 0; i < 3 && (await focused()) !== "password"; i++) {
    await page.keyboard.press("Tab")
  }
  expect(await focused()).toBe("password")
  await page.keyboard.type(school.owner.password)
  await page.keyboard.press("Enter")
  await page.waitForURL("**/dashboard")
  await settle(page)

  if (testInfo.project.name === "mobile") {
    // The sidebar is a sheet behind the menu button on phones.
    const trigger = page.getByRole("button", { name: "Show or hide the menu" })
    await trigger.focus()
    await page.keyboard.press("Enter")
  }
  // Tab reaches the sidebar's links; Enter follows one.
  const target = page
    .getByRole("navigation", { name: "Main menu" })
    .getByRole("link")
    .filter({ hasText: /Notices|Students/ })
    .first()
  await expect(target).toBeVisible()
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab")
    if (await target.evaluate((el) => el === document.activeElement)) break
  }
  await expect(target).toBeFocused()
  const href = await target.getAttribute("href")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(new RegExp(`${href}$`))
})
