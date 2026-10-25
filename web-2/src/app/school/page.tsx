import { GlobeIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import {
  getSchoolHome,
  schoolName,
  type SchoolHome,
} from "~/api/public/school-home"
import { KampasyMark } from "~/components/brand/kampasy-mark"
import { LanguageSwitch } from "~/components/language-switch"
import { SchoolLogo } from "~/components/school-logo"
import { ThemeToggle } from "~/components/theme-toggle"
import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import { formatDate } from "~/lib/format"
import { requireSchoolSlug } from "~/lib/request-host"
import { getSession } from "~/lib/session"
import { homeFor } from "~/lib/session/home"

export async function generateMetadata(): Promise<Metadata> {
  const home = await getSchoolHome(await requireSchoolSlug())
  return { title: { absolute: schoolName(home, await getLocale()) } }
}

/**
 * The school's public home page: branding, about, public notices and
 * contact (as far as the school publishes them), and the way in: "Sign
 * in", or "Go to your dashboard" for someone already signed in here.
 */
export default async function SchoolHomePage() {
  const home = await getSchoolHome(await requireSchoolSlug())
  const session = await getSession()
  const locale = await getLocale()
  const t = await getTranslations("schoolHome")
  const tc = await getTranslations("common")
  const name = schoolName(home, locale)
  const about = (locale === "bn" ? home.aboutBn : null) || home.about
  const notices = home.notices ?? []

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-end gap-1 px-4 py-3">
        <LanguageSwitch />
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 pt-6 pb-12 sm:pt-12">
        <section className="flex flex-col items-center gap-6 text-center">
          <SchoolLogo
            name={name}
            logoUrl={home.logoUrl}
            alt={t("logoAlt", { school: name })}
            className="size-20 text-2xl"
          />
          <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
            {name}
          </h1>
          {about && (
            <p className="max-w-prose text-pretty text-muted-foreground">
              {about}
            </p>
          )}
          {session ? (
            <a
              href={homeFor(session)}
              className={buttonVariants({ size: "lg" })}
            >
              {t("goToDashboard")}
            </a>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <a href="/login" className={buttonVariants({ size: "lg" })}>
                {t("signIn")}
              </a>
              <p className="text-sm text-muted-foreground">{t("signInHint")}</p>
            </div>
          )}
        </section>

        {notices.length > 0 && (
          <section aria-labelledby="notices" className="flex flex-col gap-4">
            <h2 id="notices" className="font-display text-xl font-semibold">
              {t("notices")}
            </h2>
            <ul className="flex flex-col gap-3">
              {notices.map((notice) => (
                <li key={notice.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{notice.title}</h3>
                    {notice.pinned && (
                      <Badge variant="secondary">{t("pinned")}</Badge>
                    )}
                  </div>
                  {notice.publishAt && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(notice.publishAt, {
                        format: "D MMM YYYY",
                        language: locale === "bn" ? "bn" : "en",
                        numerals: locale === "bn" ? "bn" : "en",
                      })}
                    </p>
                  )}
                  <p className="mt-2 text-sm whitespace-pre-line">
                    {notice.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Contact home={home} labels={t} />
      </main>
      <footer className="flex items-center justify-center gap-2 pb-6 text-sm text-muted-foreground">
        <KampasyMark className="size-4" />
        {tc("poweredBy")}
      </footer>
    </div>
  )
}

function Contact({
  home,
  labels: t,
}: {
  home: SchoolHome
  labels: (key: "contact" | "phone" | "email" | "website" | "address") => string
}) {
  const contact = home.contact
  const address = [
    home.address?.line1,
    home.address?.line2,
    home.address?.area,
    [home.address?.district, home.address?.postCode].filter(Boolean).join(" "),
  ].filter(Boolean)
  if (
    !contact?.phone &&
    !contact?.email &&
    !contact?.website &&
    !address.length
  )
    return null

  const rows = [
    contact?.phone && {
      icon: PhoneIcon,
      label: t("phone"),
      value: contact.phone,
      href: `tel:${contact.phone.replace(/\s+/g, "")}`,
    },
    contact?.email && {
      icon: MailIcon,
      label: t("email"),
      value: contact.email,
      href: `mailto:${contact.email}`,
    },
    contact?.website && {
      icon: GlobeIcon,
      label: t("website"),
      value: contact.website.replace(/^https?:\/\//, ""),
      href: /^https?:\/\//.test(contact.website)
        ? contact.website
        : `https://${contact.website}`,
    },
    address.length > 0 && {
      icon: MapPinIcon,
      label: t("address"),
      value: address.join(", "),
      href: null,
    },
  ].filter((row) => !!row)

  return (
    <section aria-labelledby="contact" className="flex flex-col gap-4">
      <h2 id="contact" className="font-display text-xl font-semibold">
        {t("contact")}
      </h2>
      <dl className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <div key={label} className="flex items-start gap-3">
            <Icon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <dt className="sr-only">{label}</dt>
            <dd className="min-w-0 text-sm break-words">
              {href ? (
                <a href={href} className="underline-offset-4 hover:underline">
                  {value}
                </a>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
