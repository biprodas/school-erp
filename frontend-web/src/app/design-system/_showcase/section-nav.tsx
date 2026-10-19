"use client"

import { useEffect, useState } from "react"
import { cn } from "~/lib/utils"

export type NavSection = { id: string; label: string }

/** Tracks which section is in view, so the nav can mark it as current. */
function useActiveSection(sections: NavSection[]) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const ids = sections.map((section) => section.id)
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting)
        setActive(ids.find((id) => visible.get(id)) ?? null)
      },
      // A band counts as current once it reaches the upper third of the viewport.
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
      <p className="type-caption px-3 pb-2 font-mono text-subtle-foreground">On this page</p>
      <ul className="flex flex-col gap-0.5">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "true" : undefined}
              className={cn(
                "type-label flex rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active === section.id && "bg-secondary text-secondary-foreground"
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
