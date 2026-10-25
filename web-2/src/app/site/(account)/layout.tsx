import { getTranslations } from "next-intl/server"

import { LanguageSwitch } from "~/components/common/language-switch"
import { BRAND } from "~/config/brand-config"

import { Logo } from "~/features/marketing/components/logo"
import { ThemeSwitch } from "~/features/marketing/components/theme-switch"
import { AccountHeaderLink } from "~/features/signup/components/account-header-link"

/**
 * Signup and "Find your school": the marketing site's header line (logo
 * home, language, theme, the other way in), the page's column centered
 * in what's left, and a footer with a way to reach us.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("signup")
  const row = "mx-auto flex w-full max-w-6xl items-center px-4 sm:px-6"

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className={`${row} h-16 gap-2`}>
          <Logo className="mr-auto rounded-md text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
          <LanguageSwitch />
          <ThemeSwitch />
          <AccountHeaderLink />
        </div>
      </header>
      {/* Centered, a little above the middle: the eye starts high. */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pt-10 pb-16 sm:pb-24">
        <div className="flex w-full max-w-lg flex-col gap-6">{children}</div>
      </main>
      <footer className="border-t bg-background">
        <div
          className={`${row} flex-col gap-1 py-5 text-sm text-muted-foreground sm:flex-row sm:justify-between`}
        >
          <p>
            {t("copyright", {
              // A string: as a number it would print as "2,026".
              year: String(new Date().getFullYear()),
              brand: BRAND.name,
            })}
          </p>
          <p>
            {t("help")}{" "}
            <a
              href={`mailto:${BRAND.contactEmail}`}
              className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {BRAND.contactEmail}
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
