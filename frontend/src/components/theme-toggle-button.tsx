"use client"

import * as React from "react"
import { Button } from "~/components/ui/button"
import { SunIcon, MoonStarIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useMounted } from "~/hooks/use-mounted"

export const ThemeToggleButton = () => {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="relative"
      disabled={!mounted}
      onClick={() =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
      aria-label={
        resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      <SunIcon className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonStarIcon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
