import { getTranslations } from "next-intl/server"

import { BrandMark } from "~/components/brand/brand-mark"
import { LanguageSwitch } from "~/components/common/language-switch"
import { ThemeChoice } from "~/components/common/theme-choice"
import { BRAND } from "~/config/brand-config"

/**
 * Sign-in on the admin host: the brand at the top, the card centred in the
 * page, and help, language and theme along the bottom.
 */
export default async function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("admin")
  return (
    <div className="flex min-h-svh flex-col bg-muted/40 px-4">
      <header className="flex justify-center pt-8 sm:pt-10">
        <p className="flex items-center gap-2.5">
          <BrandMark className="size-8" />
          <span className="font-display text-lg font-semibold">
            {t("title", { brand: BRAND.name })}
          </span>
        </p>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="mx-auto flex w-full max-w-md items-center justify-between gap-4 pb-6 text-sm text-muted-foreground">
        <p>
          {t("login.help")}{" "}
          <a
            href={`mailto:${BRAND.contactEmail}`}
            className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {t("login.contact")}
          </a>
        </p>
        <div className="flex items-center gap-1">
          <LanguageSwitch />
          <ThemeChoice />
        </div>
      </footer>
    </div>
  )
}
