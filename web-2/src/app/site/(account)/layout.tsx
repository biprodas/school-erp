import { getTranslations } from "next-intl/server"

import { LanguageSwitch } from "~/components/common/language-switch"
import { ThemeToggle } from "~/components/common/theme-toggle"
import { BRAND } from "~/config/brand-config"

import { Logo } from "../_landing/logo"

/** Signup and "Find your school": the brand, a narrow column, no marketing chrome. */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("signup")

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex items-center gap-2 px-4 py-3 sm:px-6">
        <Logo className="text-lg" />
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 pt-4 pb-12 sm:pt-10">
        <div className="flex w-full max-w-lg flex-col gap-6">{children}</div>
      </main>
      <footer className="pb-6 text-center text-sm text-muted-foreground">
        {t("footer", { brand: BRAND.name })}
      </footer>
    </div>
  )
}
