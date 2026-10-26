import { MegaphoneIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { LanguageSwitch } from "~/components/common/language-switch"
import { SchoolLogo } from "~/components/common/school-logo"
import { buttonVariants } from "~/components/ui/button"
import { ThemeSwitch } from "~/features/marketing/components/theme-switch"
import { cn } from "~/lib/utils"
import { HomeContainer } from "./home-section"

/** The page's sections that are on it, for the header's links. */
export interface HomeNavLink {
  id: string
  label: string
}

/**
 * The sticky top bar: the school (home to the top), links to the page's
 * sections on wider screens, the language and day/night switches, and the
 * way in ("Sign in", or the dashboard for someone signed in here).
 */
export async function HomeHeader({
  name,
  logoUrl,
  links,
  entry,
}: {
  name: string
  logoUrl: string | null
  links: HomeNavLink[]
  entry: { href: string; label: string }
}) {
  const t = await getTranslations("schoolHome")

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <HomeContainer className="flex h-16 items-center gap-2">
        <a
          href="#top"
          className="mr-auto flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <SchoolLogo
            name={name}
            logoUrl={logoUrl}
            alt=""
            className="size-9 shrink-0"
          />
          <span className="truncate font-display text-lg leading-tight font-semibold">
            {name}
          </span>
        </a>
        {links.length > 0 && (
          <nav aria-label={t("navLabel")} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {links.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <LanguageSwitch />
        <ThemeSwitch />
        <a
          href={entry.href}
          className={cn(buttonVariants({ size: "sm" }), "ml-1 hidden sm:flex")}
        >
          {entry.label}
        </a>
      </HomeContainer>
    </header>
  )
}

/** A strip above the header while the school takes admissions. */
export async function AdmissionBanner({
  note,
  contactHref,
}: {
  note: string | null
  contactHref: string | null
}) {
  const t = await getTranslations("schoolHome")

  return (
    <div className="bg-primary text-primary-foreground">
      <HomeContainer className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
        <MegaphoneIcon className="size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">{t("admissionOpen")}</strong>
          {note && <span className="ml-2 opacity-90">{note}</span>}
        </p>
        {contactHref && (
          <a
            href={contactHref}
            className="font-medium underline underline-offset-4 hover:no-underline"
          >
            {t("admissionAsk")}
          </a>
        )}
      </HomeContainer>
    </div>
  )
}
