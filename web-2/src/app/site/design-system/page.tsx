import type { Metadata } from "next"
import Link from "next/link"

import { ThemeToggle } from "~/components/common/theme-toggle"
import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import { Kbd } from "~/components/ui/kbd"
import { Actions } from "./_sections/actions"
import { Conversation } from "./_sections/conversation"
import { DataDisplay } from "./_sections/data-display"
import { Feedback } from "./_sections/feedback"
import { Foundations } from "./_sections/foundations"
import { Inputs } from "./_sections/inputs"
import { Navigation } from "./_sections/navigation"
import { Overlays } from "./_sections/overlays"
import { SectionNav, type NavSection } from "./_showcase/section-nav"

export const metadata: Metadata = {
  title: "Design system",
  description:
    "Color tokens, type, radius and every shadcn/ui component in this app, in light and dark.",
}

const SECTIONS: NavSection[] = [
  { id: "foundations", label: "Foundations" },
  { id: "actions", label: "Actions" },
  { id: "inputs", label: "Inputs" },
  { id: "navigation", label: "Navigation" },
  { id: "data-display", label: "Data display" },
  { id: "feedback", label: "Feedback" },
  { id: "overlays", label: "Overlays" },
  { id: "conversation", label: "Conversation" },
]

export default function DesignSystemPage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 items-center gap-3 px-4 sm:px-6">
          <a href="#overview" className="flex items-center gap-2 font-semibold">
            School ERP
            <Badge variant="secondary">Design system</Badge>
          </a>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Home
            </Link>
            <ThemeToggle />
          </div>
        </div>
        {/* Small screens: a scrolling strip. Large screens use the left rail. */}
        <nav aria-label="Sections" className="border-t lg:hidden">
          <ul className="flex gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {SECTIONS.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden border-r lg:block">
          <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto px-3 py-8">
            <SectionNav sections={SECTIONS} />
          </div>
        </aside>

        <main className="min-w-0">
          <section
            id="overview"
            aria-labelledby="overview-title"
            className="scroll-mt-28 lg:scroll-mt-16"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-14 sm:px-6 lg:py-20">
              <p className="font-mono text-xs text-muted-foreground">
                shadcn/ui · base-nova · Base UI · neutral
              </p>
              <h1
                id="overview-title"
                className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
              >
                Design system
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Every component in{" "}
                <code className="font-mono text-base">src/components/ui</code>,
                shown with the stock tokens from{" "}
                <code className="font-mono text-base">src/app/globals.css</code>
                . Press <Kbd>D</Kbd> or use the toggle to check dark mode.
              </p>
            </div>
          </section>

          <Foundations />
          <Actions />
          <Inputs />
          <Navigation />
          <DataDisplay />
          <Feedback />
          <Overlays />
          <Conversation />
        </main>
      </div>
    </>
  )
}
