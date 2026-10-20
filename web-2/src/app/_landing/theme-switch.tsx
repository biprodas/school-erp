"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

/**
 * A day/night pill: the thumb slides between the sun and the moon. Position
 * and colours come from the `dark` class, so server and client markup match
 * before the theme is known.
 */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative inline-flex h-8 w-15 shrink-0 cursor-pointer items-center justify-between rounded-full border bg-muted px-2 text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <SunIcon className="size-3.5" />
      <MoonIcon className="size-3.5" />
      <span className="absolute top-0.5 left-0.5 flex size-6.5 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-sm ring-1 ring-foreground/5 transition-transform duration-300 ease-out dark:translate-x-7 dark:bg-brand-foreground dark:text-brand">
        <SunIcon className="size-3.5 dark:hidden" />
        <MoonIcon className="hidden size-3.5 dark:block" />
      </span>
    </button>
  )
}
