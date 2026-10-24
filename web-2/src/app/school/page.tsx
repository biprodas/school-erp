import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/api/public/school-home"
import { KampasyMark } from "~/components/brand/kampasy-mark"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { buttonVariants } from "~/components/ui/button"
import { requireSchoolSlug } from "~/lib/request-host"

export async function generateMetadata(): Promise<Metadata> {
  const home = await getSchoolHome(await requireSchoolSlug())
  return { title: { absolute: schoolName(home, await getLocale()) } }
}

/**
 * The school's public home page. M1 shows the branding; public notices,
 * contact and address follow with the sign-in work (M3).
 */
export default async function SchoolHomePage() {
  const home = await getSchoolHome(await requireSchoolSlug())
  const locale = await getLocale()
  const t = await getTranslations("schoolHome")
  const tc = await getTranslations("common")
  const name = schoolName(home, locale)

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-4 py-12">
      <section className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Avatar className="size-20 rounded-2xl after:rounded-2xl">
          {home.logoUrl && (
            <AvatarImage
              src={home.logoUrl}
              alt={t("logoAlt", { school: name })}
              className="rounded-2xl"
            />
          )}
          <AvatarFallback className="rounded-2xl font-display text-2xl">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
          {name}
        </h1>
        <p className="text-muted-foreground">{t("signInHint")}</p>
        <a href="/login" className={buttonVariants({ size: "lg" })}>
          {t("signIn")}
        </a>
      </section>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <KampasyMark className="size-4" />
        {tc("poweredBy")}
      </p>
    </main>
  )
}

/** Up to two initials for the logo placeholder: "Dhaka Ideal School" → "DI". */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
