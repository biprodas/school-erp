import { GlobeIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { BrandMark } from "~/components/brand/brand-mark"
import { BRAND } from "~/config/brand-config"
import { cn } from "~/lib/utils"
import type { SchoolHome } from "../api"
import { HomeContainer, HomeHeading } from "./home-section"

interface ContactRow {
  icon: typeof PhoneIcon
  label: string
  value: string
  href: string | null
}

/** The phone, email, website and address the school publishes, if any. */
export async function contactRows(home: SchoolHome): Promise<ContactRow[]> {
  const t = await getTranslations("schoolHome")
  const contact = home.contact
  const address = [
    home.address?.line1,
    home.address?.line2,
    home.address?.area,
    [home.address?.district, home.address?.postCode].filter(Boolean).join(" "),
  ].filter(Boolean)

  return [
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
  ].filter((row): row is ContactRow => !!row)
}

/** How to reach the school. */
export async function HomeContact({
  rows,
  wide = false,
}: {
  rows: ContactRow[]
  /** Full page width (no notices beside it): two columns. */
  wide?: boolean
}) {
  const t = await getTranslations("schoolHome")

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="flex scroll-mt-20 flex-col gap-6"
    >
      <HomeHeading id="contact">{t("contact")}</HomeHeading>
      <dl
        className={cn(
          "grid gap-px overflow-hidden rounded-xl border bg-border",
          wide && "sm:grid-cols-2"
        )}
      >
        {rows.map(({ icon: Icon, label, value, href }) => (
          <div
            key={label}
            className={cn(
              "flex items-start gap-4 bg-card p-5",
              wide && "last:odd:sm:col-span-2"
            )}
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </dt>
              <dd className="text-sm break-words">
                {href ? (
                  <a
                    href={href}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The school's name and year, and the service it runs on. */
export async function HomeFooter({
  name,
  year,
}: {
  name: string
  /** Already in the page's digits. */
  year: string
}) {
  const t = await getTranslations("schoolHome")
  const tc = await getTranslations("common")

  return (
    <footer className="border-t">
      <HomeContainer className="flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>{t("copyright", { school: name, year })}</p>
        <p className="flex items-center gap-2">
          <BrandMark className="size-4" />
          {tc("poweredBy", { brand: BRAND.name })}
        </p>
      </HomeContainer>
    </footer>
  )
}
