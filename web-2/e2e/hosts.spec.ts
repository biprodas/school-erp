import { expect, test } from "@playwright/test"

// Host routing (src/proxy.ts) through real `*.lvh.me` hosts, which resolve
// to 127.0.0.1. The school test needs the backend running with a school
// whose slug is in E2E_SCHOOL_SLUG (for example `acme`).

const base = new URL(process.env.E2E_BASE_URL ?? "http://lvh.me:3000")
const onHost = (subdomain: string, path = "/") =>
  `${base.protocol}//${subdomain}.${base.hostname}${base.port ? `:${base.port}` : ""}${path}`

test("the admin host serves the admin app", async ({ page }) => {
  const response = await page.goto(onHost("admin"))
  expect(response?.status()).toBe(200)
  await expect(page.getByText("Kampasy admin")).toBeVisible()
})

test("a reserved subdomain is not a school", async ({ page }) => {
  const response = await page.goto(onHost("api"))
  expect(response?.status()).toBe(404)
  await expect(page.getByText("We couldn't find this school")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Find your school" })
  ).toHaveAttribute("href", `${base.origin}/find-school`)
})

test("internal trees can't be requested directly", async ({ page }) => {
  const response = await page.goto("/school")
  expect(response?.status()).toBe(404)
  await expect(page.getByText("Page not found")).toBeVisible()
})

test("a school host shows the school", async ({ page }) => {
  const slug = process.env.E2E_SCHOOL_SLUG
  test.skip(!slug, "set E2E_SCHOOL_SLUG to a school in the running backend")

  const response = await page.goto(onHost(slug!))
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
})
