import { getTranslations } from "next-intl/server"

import { SchoolLogo } from "~/components/common/school-logo"
import { buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { HomeContainer } from "./home-section"

/**
 * The school's name over its photo (darkened so the text reads) or, without
 * one, over a faint grid tinted with its color; the tagline, the year it was
 * founded, and the way in.
 */
export async function HomeHero({
  name,
  logoUrl,
  tagline,
  established,
  imageUrl,
  entry,
  secondary,
}: {
  name: string
  logoUrl: string | null
  tagline: string | null
  /** Already in the page's digits. */
  established: string | null
  imageUrl: string | null
  entry: { href: string; label: string; hint: string | null }
  secondary: { href: string; label: string } | null
}) {
  const t = await getTranslations("schoolHome")
  const onImage = !!imageUrl

  return (
    <section
      id="top"
      aria-labelledby="top-title"
      className={cn(
        "relative isolate overflow-hidden border-b",
        onImage && "text-white"
      )}
    >
      {imageUrl ? (
        <>
          {/* Signed storage URL, short-lived: nothing for an image optimizer to cache. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 -z-20 size-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/55 to-black/25" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10 bg-primary/[0.07] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[48px_48px]">
          <div className="size-full bg-linear-to-b from-transparent via-background/40 to-background" />
        </div>
      )}
      <HomeContainer
        className={cn(
          "flex flex-col gap-6 py-16 sm:py-24",
          onImage && "min-h-[30rem] justify-end sm:min-h-[36rem]"
        )}
      >
        <SchoolLogo
          name={name}
          logoUrl={logoUrl}
          alt={t("logoAlt", { school: name })}
          className={cn(
            "size-20 shadow-sm sm:size-24 [&_[data-slot=avatar-fallback]]:bg-primary [&_[data-slot=avatar-fallback]]:text-3xl [&_[data-slot=avatar-fallback]]:text-primary-foreground",
            onImage && "bg-white ring-4 ring-white/30"
          )}
        />
        <div className="flex max-w-3xl flex-col gap-4">
          {established && (
            <p
              className={cn(
                "text-sm font-semibold tracking-wide uppercase",
                onImage ? "text-white/80" : "text-primary"
              )}
            >
              {t("established", { year: established })}
            </p>
          )}
          <h1
            id="top-title"
            className="font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-6xl"
          >
            {name}
          </h1>
          {tagline && (
            <p
              className={cn(
                "max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl",
                onImage ? "text-white/85" : "text-muted-foreground"
              )}
            >
              {tagline}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-wrap gap-3">
            <a
              href={entry.href}
              className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
            >
              {entry.label}
            </a>
            {secondary && (
              <a
                href={secondary.href}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full",
                  onImage &&
                    "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white dark:border-white/40 dark:bg-white/10 dark:hover:bg-white/20"
                )}
              >
                {secondary.label}
              </a>
            )}
          </div>
          {entry.hint && (
            <p
              className={cn(
                "text-sm",
                onImage ? "text-white/75" : "text-muted-foreground"
              )}
            >
              {entry.hint}
            </p>
          )}
        </div>
      </HomeContainer>
    </section>
  )
}
