import { cn } from "~/lib/utils"

/** Page-width wrapper shared by the home page's sections. */
export function HomeContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
      {...props}
    />
  )
}

/** A section reachable from the header (`#id`), clear of the sticky bar. */
export function HomeSection({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-20 py-16 sm:py-20", className)}
    >
      <HomeContainer>{children}</HomeContainer>
    </section>
  )
}

/** The section's heading, with a short colored rule above it. */
export function HomeHeading({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <h2
      id={`${id}-title`}
      className={cn(
        "font-display text-3xl font-semibold text-balance before:mb-4 before:block before:h-1 before:w-10 before:rounded-full before:bg-primary sm:text-4xl",
        className
      )}
    >
      {children}
    </h2>
  )
}
