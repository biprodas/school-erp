import { createSchool, openSchool, ownerPage, settle } from "./support/school"
import { expect, expectAccessible, test } from "./support/test"

// PRD 6.24: the school edits its public home page in settings, and the
// page shows it.

test("the owner fills in the home page and visitors see it", async ({
  page,
  browser,
}) => {
  const school = await createSchool("homepage")
  await ownerPage(page, school)
  await openSchool(page, school)

  await page.goto(school.url("/dashboard/settings/home-page"))
  await settle(page)
  await expect(
    page.getByRole("heading", { name: "Home page", level: 1 })
  ).toBeVisible()
  await expectAccessible(page)

  await page.getByLabel("Tagline", { exact: true }).fill("Learning for life.")
  await page.getByLabel("Year founded").fill("1972")
  await page
    .getByLabel("About", { exact: true })
    .fill("We teach Class 1 to 10.")

  await page.getByRole("button", { name: "Add a fact" }).click()
  await page.getByLabel("Number").fill("1,200")
  await page.getByLabel("What it counts").fill("Students")

  await page.getByRole("button", { name: "Add a highlight" }).click()
  await page.getByLabel("Title", { exact: true }).fill("Science labs")

  await page.getByLabel("Principal's name").fill("Rahima Begum")
  await page
    .getByLabel("Message", { exact: true })
    .fill("Welcome to our school.")

  await page.getByRole("switch", { name: "Admissions are open" }).click()
  await page.getByLabel("Banner text", { exact: true }).fill("Class 6 to 9")

  await expect(page.getByText("You have unsaved changes.")).toBeVisible()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Home page saved")).toBeVisible()
  await expect(page.getByText("All changes saved.")).toBeVisible()

  // A half-filled fact row is caught before it reaches the server.
  await page.getByRole("button", { name: "Add a fact" }).click()
  await page.getByLabel("Number").nth(1).fill("64")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Fill this in, or remove the row.")).toBeVisible()
  await page.getByRole("button", { name: "Remove fact 2" }).click()

  // A visitor (no session) sees it on the school's home page.
  const context = await browser.newContext()
  const visitor = await context.newPage()
  await visitor.goto(school.url("/"))
  await expect(
    visitor.getByRole("heading", { name: school.name, level: 1 })
  ).toBeVisible()
  await expect(visitor.getByText("Learning for life.")).toBeVisible()
  await expect(visitor.getByText("Established 1972")).toBeVisible()
  await expect(visitor.getByText("1,200")).toBeVisible()
  await expect(visitor.getByText("Science labs")).toBeVisible()
  await expect(visitor.getByText("Welcome to our school.")).toBeVisible()
  await expect(visitor.getByText("Admissions open")).toBeVisible()
  await expectAccessible(visitor)

  // Turned off, the school has no home page: `/` goes to sign-in, whose
  // header no longer links back to it.
  await page.getByRole("switch", { name: "Show a home page" }).click()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Home page saved")).toBeVisible()
  await expect(page.getByRole("link", { name: "View home page" })).toHaveCount(
    0
  )
  await visitor.goto(school.url("/"))
  await expect(visitor).toHaveURL(/\/login$/)
  await expect(visitor.getByRole("link", { name: school.name })).toHaveCount(0)
  await context.close()
})
