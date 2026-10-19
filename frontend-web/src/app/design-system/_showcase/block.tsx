import { cn } from "~/lib/utils"
import type { ReactNode } from "react"

/** A full-width band of the design system page, with an anchor and a heading. */
export function ShowcaseSection({
  id,
  eyebrow,
  title,
  description,
  dark = false,
  className,
  children,
}: {
  id: string
  eyebrow?: string
  title: string
  description?: ReactNode
  /** Renders the band on forest with the dark tokens, like the landing page's dark bands. */
  dark?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-10 border-t bg-background text-foreground lg:scroll-mt-0",
        dark && "dark bg-band",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 lg:py-24">
        <header className="flex max-w-2xl flex-col gap-4">
          {eyebrow ? <p className="type-eyebrow text-primary">{eyebrow}</p> : null}
          <h2 id={`${id}-title`} className="type-display-lg">
            {title}
          </h2>
          {description ? (
            <div className="type-lead text-muted-foreground">{description}</div>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  )
}

/** One component or foundation: name, when to use it, then its examples. */
export function Block({
  name,
  when,
  wide = false,
  className,
  children,
}: {
  name: string
  when: ReactNode
  /** Spans both columns of a `BlockGrid`. Use for wide components. */
  wide?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <article
      className={cn("flex min-w-0 flex-col gap-5", wide && "lg:col-span-2", className)}
    >
      <div className="flex flex-col gap-1">
        <h3 className="type-title">{name}</h3>
        <p className="type-body text-muted-foreground">{when}</p>
      </div>
      {children}
    </article>
  )
}

/** Two-column grid of blocks on large screens. */
export function BlockGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("grid gap-x-10 gap-y-14 lg:grid-cols-2", className)}>{children}</div>
}

/** A labeled preview frame. `title` names what the frame shows, never a state inside a component. */
export function Example({
  title,
  className,
  frameClassName,
  children,
}: {
  title?: string
  className?: string
  /** Classes for the inner preview surface (layout only). */
  frameClassName?: string
  children: ReactNode
}) {
  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", className)}>
      {title ? (
        <figcaption className="type-caption font-mono text-subtle-foreground">{title}</figcaption>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-3 rounded-2xl bg-card p-5 text-card-foreground ring-1 ring-border",
          frameClassName
        )}
      >
        {children}
      </div>
    </figure>
  )
}
