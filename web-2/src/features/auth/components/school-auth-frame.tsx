import { getLocale } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/features/school-site/api"
import { LanguageSwitch } from "~/components/common/language-switch"
import { SchoolLogo } from "~/components/common/school-logo"
import { ThemeSwitch } from "~/features/marketing/components/theme-switch"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"

/**
 * Sign-in, activation, password and setup pages on a school host: a
 * header line with the school (its logo and name, home to its page) and
 * the language and day/night switches, as on signup; the page's card
 * centered below. No footer: the page is the school's, and nothing
 * should compete with its card.
 */
export async function SchoolAuthFrame({
  children,
}: {
  children: React.ReactNode
}) {
  const home = await getSchoolHome(await requireSchoolSlug())
  const name = schoolName(home, await getLocale())
  const row = "mx-auto flex w-full max-w-6xl items-center px-4 sm:px-6"
  const school = (
    <>
      <SchoolLogo
        name={name}
        logoUrl={home.logoUrl}
        alt=""
        className="size-9 shrink-0"
      />
      <span className="truncate font-display text-lg leading-tight font-semibold">
        {name}
      </span>
    </>
  )

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className={`${row} h-16 gap-2`}>
          {/* No link when the school has no home page: `/` would come back here. */}
          {home.enabled ? (
            <a
              href="/"
              className="mr-auto flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {school}
            </a>
          ) : (
            <div className="mr-auto flex min-w-0 items-center gap-2.5">
              {school}
            </div>
          )}
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </header>
      {/* A little above the middle: the eye starts high. */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pt-8 pb-16 sm:pb-24">
        <div className="flex w-full max-w-md flex-col gap-6">{children}</div>
      </main>
    </div>
  )
}
