"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"

import { cn } from "~/lib/utils"

const option =
  "flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 [&_svg]:size-4"

/**
 * Light and dark side by side, the current one raised. Which one looks
 * selected comes from the `dark` class, so server and client markup match
 * before the theme is known; `aria-pressed` follows once it is.
 */
export function ThemeChoice({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const t = useTranslations("common")

  return (
    <div
      role="group"
      aria-label={t("theme")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5",
        className
      )}
    >
      <button
        type="button"
        aria-label={t("themeLight")}
        title={t("themeLight")}
        aria-pressed={resolvedTheme ? resolvedTheme === "light" : undefined}
        onClick={() => setTheme("light")}
        className={cn(
          option,
          "bg-muted text-foreground dark:bg-transparent dark:text-muted-foreground"
        )}
        suppressHydrationWarning
      >
        <SunIcon aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("themeDark")}
        title={t("themeDark")}
        aria-pressed={resolvedTheme ? resolvedTheme === "dark" : undefined}
        onClick={() => setTheme("dark")}
        className={cn(option, "dark:bg-muted dark:text-foreground")}
        suppressHydrationWarning
      >
        <MoonIcon aria-hidden />
      </button>
    </div>
  )
}
