import { cn } from "~/lib/utils"

/** Page-width wrapper shared by every landing section. */
export function Container({
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

export function Section({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("scroll-mt-16 border-b py-20 sm:py-24", className)}
      {...props}
    />
  )
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm font-semibold text-primary", className)}
      {...props}
    />
  )
}

export function DisplayHeading({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "font-display text-4xl leading-[0.95] text-balance sm:text-5xl lg:text-6xl",
        className
      )}
      {...props}
    />
  )
}

export function Lead({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export function SectionIntro({
  eyebrow,
  title,
  children,
  align = "start",
  className,
}: {
  eyebrow: string
  title: React.ReactNode
  children?: React.ReactNode
  align?: "start" | "center"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <DisplayHeading className="max-w-3xl">{title}</DisplayHeading>
      {children && <Lead>{children}</Lead>}
    </div>
  )
}
