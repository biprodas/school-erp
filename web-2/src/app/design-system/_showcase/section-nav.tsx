"use client"

import * as React from "react"

import { cn } from "~/lib/utils"

export type NavSection = { id: string; label: string }

/** Tracks which section is in view, so the nav can mark it as current. */
function useActiveSection(sections: NavSection[]) {
  const [active, setActive] = React.useState<string | null>(null)

  React.useEffect(() => {
    const ids = sections.map((section) => section.id)
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting)
        }
        setActive(ids.find((id) => visible.get(id)) ?? null)
      },
      // A section counts as current once it reaches the upper third of the viewport.
      { rootMargin: "-20% 0px -65% 0px" }
    )
    for (const id of ids) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [sections])

  return active
}

/** Vertical section list for the left rail on large screens. */
export function SectionNav({ sections }: { sections: NavSection[] }) {
  const active = useActiveSection(sections)

  return (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      <p className="px-3 pb-2 font-mono text-xs text-muted-foreground">
        On this page
      </p>
      <ul className="flex flex-col gap-0.5">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "true" : undefined}
              className={cn(
                "flex rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active === section.id && "bg-muted font-medium text-foreground"
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
