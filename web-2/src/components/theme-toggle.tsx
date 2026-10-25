"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"

import { Button } from "~/components/ui/button"

/**
 * Switches between light and dark. Both icons are rendered and CSS picks one,
 * so the server and client markup match before the theme is known.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const t = useTranslations("common")

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon aria-hidden className="hidden dark:block" />
      <MoonIcon aria-hidden className="dark:hidden" />
    </Button>
  )
}
