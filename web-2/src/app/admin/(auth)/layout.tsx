import { getTranslations } from "next-intl/server"

import { BrandMark } from "~/components/brand/brand-mark"
import { LanguageSwitch } from "~/components/language-switch"
import { ThemeToggle } from "~/components/theme-toggle"
import { BRAND } from "~/config/brand-config"

/** Sign-in on the admin host: the brand above a centered card. */
export default async function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("admin")
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex items-center justify-end gap-1 px-4 py-3">
        <LanguageSwitch />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center px-4 pt-4 pb-12 sm:pt-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <p className="flex items-center gap-3 self-center">
            <BrandMark className="size-9" />
            <span className="font-display text-lg font-semibold">
              {t("title", { brand: BRAND.name })}
            </span>
          </p>
          {children}
        </div>
      </main>
    </div>
  )
}
