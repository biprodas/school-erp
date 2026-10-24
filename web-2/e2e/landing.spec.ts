import { expect, test } from "@playwright/test"

test("the landing page renders in the default language", async ({ page }) => {
  await page.goto("/")

  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})
