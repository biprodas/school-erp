import { adminUrl, E2E, onHost } from "./support/env"
import { createSchool } from "./support/school"
import { expect, test } from "./support/test"

// Host routing (src/proxy.ts) through real `*.lvh.me` hosts, which resolve
// to 127.0.0.1.

test("the admin host serves the admin app", async ({ page }) => {
  const response = await page.goto(adminUrl("/"))
  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText("School ERP admin")).toBeVisible()
})

test("a reserved subdomain is not a school", async ({ page }) => {
  const response = await page.goto(onHost("api"))
  expect(response?.status()).toBe(404)
  await expect(page.getByText("We couldn't find this school")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Find your school" })
  ).toHaveAttribute("href", `${E2E.base.origin}/find-school`)
})

test("internal trees can't be requested directly", async ({ page }) => {
  const response = await page.goto("/school")
  expect(response?.status()).toBe(404)
  await expect(page.getByText("Page not found")).toBeVisible()
})

test("a school host shows the school", async ({ page }) => {
  const school = await createSchool("host")
  const response = await page.goto(school.url("/"))
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
})
