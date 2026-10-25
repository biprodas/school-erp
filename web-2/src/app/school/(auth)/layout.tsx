import { getLocale, getTranslations } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/api/public/school-home"
import { KampasyMark } from "~/components/brand/kampasy-mark"
import { LanguageSwitch } from "~/components/language-switch"
import { SchoolLogo } from "~/components/school-logo"
import { ThemeToggle } from "~/components/theme-toggle"
import { requireSchoolSlug } from "~/lib/request-host"

/**
 * Sign-in, activation, password and setup pages on a school host: the
 * school's logo and name above a centered card, with the language and
 * theme switches.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const home = await getSchoolHome(await requireSchoolSlug())
  const name = schoolName(home, await getLocale())
  const tc = await getTranslations("common")

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex items-center justify-end gap-1 px-4 py-3">
        <LanguageSwitch />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center px-4 pt-4 pb-12 sm:pt-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <a
            href="/"
            className="flex items-center gap-3 self-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SchoolLogo
              name={name}
              logoUrl={home.logoUrl}
              alt=""
              className="size-10"
            />
            <span className="font-display text-lg font-semibold text-balance">
              {name}
            </span>
          </a>
          {children}
        </div>
      </main>
      <footer className="flex items-center justify-center gap-2 pb-6 text-sm text-muted-foreground">
        <KampasyMark className="size-4" />
        {tc("poweredBy")}
      </footer>
    </div>
  )
}
