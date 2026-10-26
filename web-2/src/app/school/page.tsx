import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import {
  getSchoolHome,
  localized,
  schoolName,
} from "~/features/school-site/api"
import {
  HomeAbout,
  HomeFacts,
} from "~/features/school-site/components/home-about"
import {
  contactRows,
  HomeContact,
  HomeFooter,
} from "~/features/school-site/components/home-contact"
import {
  AdmissionBanner,
  HomeHeader,
  type HomeNavLink,
} from "~/features/school-site/components/home-header"
import { HomeHero } from "~/features/school-site/components/home-hero"
import { HomeNotices } from "~/features/school-site/components/home-notices"
import { HomePrincipal } from "~/features/school-site/components/home-principal"
import { HomeContainer } from "~/features/school-site/components/home-section"
import { SchoolTheme } from "~/features/school-site/components/school-theme"
import { getSession } from "~/lib/auth"
import { homeFor } from "~/lib/auth/home"
import { toBanglaDigits } from "~/lib/format"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"
import { cn } from "~/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const home = await getSchoolHome(await requireSchoolSlug())
  const locale = await getLocale()
  return {
    title: { absolute: schoolName(home, locale) },
    description:
      localized(locale, home.tagline, home.taglineBn) ??
      localized(locale, home.about, home.aboutBn)?.slice(0, 160),
  }
}

/**
 * The school's public home page (PRD 6.24): its name, colors and photo,
 * then whatever the school publishes through `profile.homePage` (about and
 * highlights, the principal's message, facts, an admission banner, public
 * notices, contact), and the way in: "Sign in", or "Go to your dashboard"
 * for someone already signed in here. Sections the school left empty are
 * left out, header links included. A school that turned its home page off
 * has none: visitors go to sign-in, signed-in members to their home.
 */
export default async function SchoolHomePage() {
  const home = await getSchoolHome(await requireSchoolSlug())
  const session = await getSession()
  if (!home.enabled) redirect(session ? homeFor(session) : "/login")
  const locale = await getLocale()
  const t = await getTranslations("schoolHome")
  const digits = (n: number) =>
    locale === "bn" ? toBanglaDigits(String(n)) : String(n)

  const name = schoolName(home, locale)
  const about = localized(locale, home.about, home.aboutBn)
  const highlights = (home.highlights ?? []).map((item) => ({
    title: localized(locale, item.title, item.titleBn),
    body: localized(locale, item.body, item.bodyBn),
  }))
  const facts = (home.facts ?? []).map((fact) => ({
    value: fact.value,
    label: localized(locale, fact.label, fact.labelBn),
  }))
  const principalMessage =
    home.principal &&
    localized(locale, home.principal.message, home.principal.messageBn)
  const notices = home.notices ?? []
  const contact = await contactRows(home)
  const admission = home.admission

  const entry = session
    ? { href: homeFor(session), label: t("goToDashboard"), hint: null }
    : { href: "/login", label: t("signIn"), hint: t("signInHint") }

  const links: HomeNavLink[] = [
    (about || highlights.length > 0) && { id: "about", label: t("about") },
    principalMessage && { id: "message", label: t("principalNav") },
    notices.length > 0 && { id: "notices", label: t("notices") },
    contact.length > 0 && { id: "contact", label: t("contact") },
  ].filter((link): link is HomeNavLink => !!link)

  return (
    <div className="school-home flex min-h-svh flex-col bg-background">
      <SchoolTheme colors={home.colors} />
      {admission && (
        <AdmissionBanner
          note={localized(locale, admission.note, admission.noteBn)}
          contactHref={contact.length > 0 ? "#contact" : null}
        />
      )}
      <HomeHeader
        name={name}
        logoUrl={home.logoUrl}
        links={links}
        entry={entry}
      />
      <main className="flex-1">
        <HomeHero
          name={name}
          logoUrl={home.logoUrl}
          tagline={localized(locale, home.tagline, home.taglineBn)}
          established={
            home.establishedYear ? digits(home.establishedYear) : null
          }
          imageUrl={home.heroImageUrl ?? null}
          entry={entry}
          secondary={
            notices.length > 0
              ? { href: "#notices", label: t("seeNotices") }
              : contact.length > 0
                ? { href: "#contact", label: t("contactUs") }
                : null
          }
        />
        {facts.length > 0 && <HomeFacts facts={facts} />}
        {(about || highlights.length > 0) && (
          <HomeAbout about={about} highlights={highlights} />
        )}
        {home.principal && principalMessage && (
          <HomePrincipal
            name={home.principal.name}
            photoUrl={home.principal.photoUrl}
            message={principalMessage}
          />
        )}
        {(notices.length > 0 || contact.length > 0) && (
          <HomeContainer
            className={cn(
              "grid gap-16 py-16 sm:py-20",
              notices.length > 0 &&
                contact.length > 0 &&
                "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
            )}
          >
            {notices.length > 0 && <HomeNotices notices={notices} />}
            {contact.length > 0 && (
              <HomeContact rows={contact} wide={notices.length === 0} />
            )}
          </HomeContainer>
        )}
      </main>
      <HomeFooter name={name} year={digits(new Date().getFullYear())} />
    </div>
  )
}
