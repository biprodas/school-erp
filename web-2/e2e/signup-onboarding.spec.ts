import { onHost, uniqueId } from "./support/env"
import { linkFromMail } from "./support/mail"
import { createSchool, ownerPage, settle } from "./support/school"
import { expect, expectAccessible, test } from "./support/test"

// Section 9: owner signup → onboarding → dashboard, all through the UI.

test("an owner signs up, verifies by email, sets the school up and lands on the dashboard", async ({
  page,
}) => {
  test.slow()
  const slug = uniqueId("signup").toLowerCase()
  const email = `owner-${slug}@example.test`

  await page.goto(onHost(null, "/signup"))
  await settle(page)
  await expectAccessible(page)
  await page.locator("#schoolName").fill(`Shapla ${slug}`)
  // The address follows the name; "Change" opens it to pick our own.
  await page.getByRole("button", { name: "Change" }).click()
  await page.locator("#slug").fill(slug)
  await expect(
    page.getByText(`${slug}.`, { exact: false }).first()
  ).toBeVisible()
  await page.locator("#ownerName").fill("Owner Rahman")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill("Owner-pass-123")
  await page.getByRole("button", { name: "Create school" }).click()

  await expect(page.getByText("Check your email")).toBeVisible()
  await expectAccessible(page)

  // The link points at the apex; open it on this run's apex host.
  const token = await linkFromMail(
    email,
    /signup\/verify\?token=([A-Za-z0-9_-]+)/
  )
  await page.goto(onHost(null, `/signup/verify?token=${token}`))
  await settle(page)
  await expectAccessible(page)
  await page.getByRole("button", { name: "Create my school" }).click()
  await page.waitForURL(`**${slug}.*/onboarding`)
  await settle(page)
  await expectAccessible(page)

  // Required steps.
  await page.getByLabel("District").fill("Dhaka")
  await page.getByLabel("Phone").fill("01712345678")
  await page.getByRole("button", { name: "Save and continue" }).click()
  await expect(
    page.getByRole("button", { name: /Academic session/ })
  ).toHaveAttribute("aria-expanded", "true")

  await page.getByRole("button", { name: "Create session" }).click()
  await expect(page.getByText(/^Current session:/)).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()

  await page.getByRole("button", { name: "Choose a template" }).click()
  const templates = page.getByRole("list", { name: "Curriculum templates" })
  await templates
    .getByRole("listitem")
    .first()
    .getByRole("button", { name: /Use this template/ })
    .click()
  await expect(page.getByText(/Template applied/).first()).toBeVisible()

  await page.getByRole("button", { name: /Classes and sections/ }).click()
  await page
    .getByRole("button", { name: /Add section A to the \d+ classes/ })
    .click()
  await expect(page.getByText(/sections added/).first()).toBeVisible()

  const finish = page.getByRole("button", { name: "Finish setup" })
  await expect(finish).toBeEnabled()
  await expectAccessible(page)
  await finish.click()

  await page.waitForURL("**/dashboard")
  await settle(page)
  await expect(
    page.getByRole("region", { name: "School overview" })
  ).toBeVisible()
  await expectAccessible(page)
})

test("an owner who skips setup lands on the dashboard with a reminder", async ({
  page,
}) => {
  const school = await createSchool("skip")
  await ownerPage(page, school)
  await page.getByRole("button", { name: "Skip for now" }).click()
  await page.waitForURL("**/dashboard")
  await expect(
    page.getByRole("region", { name: "Finish setting up your school" })
  ).toBeVisible()
})
