import { cn } from "~/lib/utils"

export interface BarRow {
  id: string
  label: string
  /** Null draws no bar (nothing recorded); `display` says why. */
  value: number | null
  /** The value as shown at the bar's tip. */
  display: string
  /** Secondary text after the label (e.g. registers in). */
  detail?: string
}

/**
 * A single-series horizontal bar chart drawn as a list, so it reads the
 * same at 360 px and to screen readers: one row per category with its
 * value at the bar's tip (dataviz: one hue for every bar, bars at most
 * 24 px thick with a 4 px rounded end, square at the baseline, a muted
 * same-surface track, values in text ink).
 */
export function BarList({
  rows,
  max,
  label,
}: {
  rows: BarRow[]
  /** The scale's end; the largest value when left out. */
  max?: number
  /** Names the list for assistive technology. */
  label: string
}) {
  const top = max ?? Math.max(0, ...rows.map((row) => row.value ?? 0))

  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const share =
          row.value === null || top <= 0
            ? 0
            : Math.min(1, Math.max(0, row.value / top))
        return (
          <li
            key={row.id}
            className="group grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 rounded-md text-sm sm:grid-cols-[minmax(0,9rem)_1fr_auto]"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{row.label}</span>
              {row.detail && (
                <span className="truncate text-xs text-muted-foreground">
                  {row.detail}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className="h-2.5 overflow-hidden rounded-r-[4px] bg-muted"
            >
              <span
                className={cn(
                  "block h-full rounded-r-[4px] bg-chart-bar transition-[width,filter] duration-300 group-hover:brightness-110",
                  share === 0 && "hidden"
                )}
                style={{ width: `${share * 100}%` }}
              />
            </span>
            <span
              className={cn(
                "min-w-12 text-right tabular-nums",
                row.value === null && "text-muted-foreground"
              )}
            >
              {row.display}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
