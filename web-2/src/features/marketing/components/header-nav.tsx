"use client"

import { useEffect, useState } from "react"

import { buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { NAV_LINKS } from "../links"

// A section counts as current once its top passes this line below the sticky header.
const ACTIVATION_OFFSET = 120

/** The id of the nav section currently in view, or null above the first one. */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const sections = NAV_LINKS.map((link) =>
      document.getElementById(link.href.slice(1))
    ).filter((el): el is HTMLElement => el !== null)

    function update() {
      let current: string | null = null
      let currentTop = -Infinity
      for (const section of sections) {
        const top = section.getBoundingClientRect().top
        if (top <= ACTIVATION_OFFSET && top > currentTop) {
          current = section.id
          currentTop = top
        }
      }
      // Past the end of the last section (e.g. the footer), nothing is current.
      const last = current && document.getElementById(current)
      if (last && last.getBoundingClientRect().bottom < ACTIVATION_OFFSET) {
        current = null
      }
      setActive(current)
    }

    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return active
}

export function HeaderNav() {
  const active = useActiveSection()

  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const isActive = active === link.href.slice(1)
          return (
            <li key={link.href}>
              <a
                href={link.href}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  isActive && "bg-secondary text-secondary-foreground"
                )}
              >
                {link.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
