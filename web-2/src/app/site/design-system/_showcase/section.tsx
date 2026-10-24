import type { ReactNode } from "react"

import { cn } from "~/lib/utils"

/** One band of the page: an anchor, a heading and its blocks. */
export function ShowcaseSection({
  id,
  title,
  description,
  className,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-28 border-t lg:scroll-mt-16", className)}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:py-16">
        <header className="flex max-w-2xl flex-col gap-2">
          <h2
            id={`${id}-title`}
            className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {title}
          </h2>
          {description ? (
            <div className="text-base text-muted-foreground">{description}</div>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  )
}

/** Two-column grid of blocks on large screens. */
export function BlockGrid({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("grid gap-x-10 gap-y-12 lg:grid-cols-2", className)}>
      {children}
    </div>
  )
}

/** One component: its name, when to use it, then its examples. */
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
      className={cn(
        "flex min-w-0 flex-col gap-4",
        wide && "lg:col-span-2",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">{when}</p>
      </div>
      {children}
    </article>
  )
}

/** A labeled preview frame. `title` names what the frame shows. */
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
        <figcaption className="font-mono text-xs text-muted-foreground">
          {title}
        </figcaption>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-3 rounded-xl border bg-card p-5 text-card-foreground",
          frameClassName
        )}
      >
        {children}
      </div>
    </figure>
  )
}
