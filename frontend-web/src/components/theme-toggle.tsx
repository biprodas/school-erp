"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useSyncExternalStore } from "react"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { THEME_KEY } from "~/lib/theme"

// The `dark` class on <html> is the source of truth; this subscribes to it.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}
const isDark = () => document.documentElement.classList.contains("dark")

/** Switches between the light and dark themes and remembers the choice. */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light")
    } catch {}
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(className)}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
