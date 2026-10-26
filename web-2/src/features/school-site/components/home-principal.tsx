import { QuoteIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { initials } from "~/lib/initials"
import { HomeHeading, HomeSection } from "./home-section"

/** The principal's welcome, with their photo and name when the school gave them. */
export async function HomePrincipal({
  name,
  photoUrl,
  message,
}: {
  name: string | null
  photoUrl: string | null
  message: string
}) {
  const t = await getTranslations("schoolHome")

  return (
    <HomeSection id="message" className="border-y bg-muted/40">
      <div className="grid items-start gap-10 md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
        <div className="w-40 md:w-full">
          {photoUrl ? (
            // Signed storage URL, short-lived: nothing for an image optimizer to cache.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={
                name
                  ? t("principalPhotoAlt", { name })
                  : t("principalPhotoAltUnnamed")
              }
              className="aspect-4/5 w-full rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              aria-hidden="true"
              data-initials={name ? initials(name) : ""}
              className="flex aspect-4/5 w-full items-center justify-center rounded-2xl bg-primary/10 font-display text-5xl text-primary before:content-[attr(data-initials)]"
            />
          )}
        </div>
        <figure className="flex flex-col gap-6">
          <HomeHeading id="message">{t("principalMessage")}</HomeHeading>
          <blockquote className="relative">
            <QuoteIcon
              className="absolute -top-1 -left-1 size-8 text-primary/20"
              aria-hidden="true"
            />
            <p className="pl-10 text-lg leading-relaxed text-pretty whitespace-pre-line">
              {message}
            </p>
          </blockquote>
          <figcaption className="flex flex-col pl-10">
            {name && <span className="font-semibold">{name}</span>}
            <span className="text-sm text-muted-foreground">
              {t("principal")}
            </span>
          </figcaption>
        </figure>
      </div>
    </HomeSection>
  )
}
