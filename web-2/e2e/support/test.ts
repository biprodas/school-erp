import AxeBuilder from "@axe-core/playwright"
import { test as base, expect, type Page } from "@playwright/test"

/**
 * The suite's `test`: every page a test opens is watched, and the test
 * fails on an uncaught page error or a Content Security Policy violation
 * (a script or style the CSP blocked), wherever it happened.
 */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ context }, use) => {
      const problems: string[] = []
      const watch = (page: Page) => {
        page.on("pageerror", (error) =>
          problems.push(`page error on ${page.url()}: ${error.message}`)
        )
        page.on("console", (message) => {
          if (
            /Content.Security.Policy|Refused to (load|execute|apply)/i.test(
              message.text()
            )
          ) {
            problems.push(`CSP on ${page.url()}: ${message.text()}`)
          }
        })
      }
      context.pages().forEach(watch)
      context.on("page", watch)
      await use(problems)
      expect(problems, "page errors and CSP violations").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/**
 * axe (WCAG 2.1 A and AA) on the page as it is now. `colorScheme` re-runs
 * it in the other theme, since contrast differs between them.
 */
export async function expectAccessible(
  page: Page,
  { exclude = [] }: { exclude?: string[] } = {}
) {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme })
    // The theme class follows the system setting through next-themes.
    await page.waitForFunction(
      (scheme) =>
        document.documentElement.classList.contains("dark") ===
        (scheme === "dark"),
      colorScheme
    )
    let builder = new AxeBuilder({ page }).withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
    ])
    for (const selector of exclude) builder = builder.exclude(selector)
    const { violations } = await builder.analyze()
    expect(
      violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        colorScheme,
        url: page.url(),
      })),
      `axe violations (${colorScheme})`
    ).toEqual([])
  }
  await page.emulateMedia({ colorScheme: "light" })
}
