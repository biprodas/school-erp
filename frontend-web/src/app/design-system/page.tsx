import type { Metadata } from "next"
import { Logo } from "~/components/landing/logo"
import { Badge } from "~/components/ui/badge"
import { ButtonLink } from "~/components/ui/button-link"
import { GridBackdrop } from "~/components/ui/grid-backdrop"
import { Separator } from "~/components/ui/separator"
import { SITE } from "~/config/site"
import { Actions } from "./_sections/actions"
import { Conversation } from "./_sections/conversation"
import { DataDisplay } from "./_sections/data-display"
import { Feedback } from "./_sections/feedback"
import { Foundations } from "./_sections/foundations"
import { DosAndDonts, Recipes } from "./_sections/guidelines"
import { Inputs } from "./_sections/inputs"
import { Navigation } from "./_sections/navigation"
import { Overlays } from "./_sections/overlays"
import { SectionNav } from "./_showcase/section-nav"
import { ThemeToggle } from "~/components/theme-toggle"

export const metadata: Metadata = {
  title: `Design system · ${SITE.name}`,
  description: "Colors, type, shape and every component of the Kampasy interface.",
}

const SECTIONS = [
  { id: "foundations", label: "Foundations" },
  { id: "actions", label: "Actions" },
  { id: "inputs", label: "Inputs" },
  { id: "navigation", label: "Navigation" },
  { id: "data-display", label: "Data display" },
  { id: "feedback", label: "Feedback" },
  { id: "overlays", label: "Overlays" },
  { id: "conversation", label: "Conversation" },
  { id: "dos-and-donts", label: "Do and don't" },
  { id: "recipes", label: "Recipes" },
]

export default function DesignSystemPage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <a href="#overview" aria-label="Design system home" className="flex shrink-0 items-center gap-3">
            <Logo />
            <Badge variant="secondary">Design system</Badge>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Landing page
            </ButtonLink>
            <ThemeToggle />
          </div>
        </div>
        {/* Small screens: a scrolling strip. Large screens use the left rail below. */}
        <nav aria-label="Sections" className="border-t lg:hidden">
          <ul className="flex gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {SECTIONS.map((section) => (
              <li key={section.id} className="shrink-0">
                <ButtonLink href={`#${section.id}`} variant="ghost" size="xs">
                  {section.label}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r lg:block">
          <div className="sticky top-16 max-h-[calc(100svh-4rem)] overflow-y-auto px-4 py-8">
            <SectionNav sections={SECTIONS} />
          </div>
        </aside>

        <main className="min-w-0">
          <section id="overview" aria-labelledby="overview-title" className="relative isolate scroll-mt-10 overflow-hidden lg:scroll-mt-0">
            <GridBackdrop glowAt="80% 30%" />
            <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 pt-16 pb-20 sm:px-6 lg:pt-24 lg:pb-28">
              <p className="type-eyebrow text-primary">Themed from DESIGN.md · shadcn/ui base-nova</p>
              <h1 id="overview-title" className="type-display-xl max-w-4xl">
                A register, done properly.
              </h1>
              <p className="type-lead max-w-2xl text-muted-foreground">
                Paper surfaces on a canvas desk, forest green ink, and one marigold mark for the
                action that matters. The same face sets <span lang="bn">বাংলা</span> and English, so
                a guardian&apos;s SMS and a principal&apos;s report read as one product.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="#foundations" size="lg" arrow>
                  Start with foundations
                </ButtonLink>
                <ButtonLink href="#recipes" size="lg" variant="outline">
                  See it composed
                </ButtonLink>
              </div>
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
          <DosAndDonts />
          <Recipes />
        </main>
      </div>

      <footer className="dark bg-band text-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <p className="type-body text-muted-foreground">
            Tokens live in <code className="font-mono text-sm">src/app/globals.css</code>, rules in{" "}
            <code className="font-mono text-sm">DESIGN.md</code>.
          </p>
          <ButtonLink href="#overview" variant="outline" size="sm" className="sm:ml-auto">
            Back to top
          </ButtonLink>
        </div>
      </footer>
    </>
  )
}
