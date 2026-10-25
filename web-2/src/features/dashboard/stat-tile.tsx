import { cn } from "~/lib/utils"

/**
 * One headline number (dataviz stat tile): a sentence-case label, the value
 * in the sans at semibold with proportional figures, and an optional line
 * of context under it.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Tiles in one column at phone width, up to three or four across. */
export function StatGrid({
  children,
  wide = false,
}: {
  children: React.ReactNode
  /** Four across on large screens instead of three. */
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2",
        wide ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
    >
      {children}
    </div>
  )
}
