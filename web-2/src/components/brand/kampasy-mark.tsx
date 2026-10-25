import { cn } from "~/lib/utils"

/**
 * The Kampasy mark: a "K" whose upper arm reaches for a highlight dot.
 * Drawn in this app's theme colors. Keep in sync with
 * `components/brand/kampasy-icon.svg` (the favicon when Kampasy is the brand) and
 * `app/apple-icon.tsx`.
 */
export function KampasyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M10.5 8.5v15M12.5 16l5-5M13.5 15.5l7 8"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <circle cx="21.75" cy="7.75" r="2.6" className="fill-highlight" />
    </svg>
  )
}
