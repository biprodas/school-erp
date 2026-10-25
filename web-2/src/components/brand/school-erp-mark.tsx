import { cn } from "~/lib/utils"

/**
 * The School ERP mark: a graduation cap on the primary color. Keep in sync
 * with `app/icon.svg` (`components/brand/school-erp-icon.svg`) and
 * `app/apple-icon.tsx`.
 */
export function SchoolErpMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <SchoolErpGlyph className="stroke-primary-foreground" />
    </svg>
  )
}

/** The cap alone, in the 32×32 box; also drawn by the Apple icon. */
export function SchoolErpGlyph({
  className,
  stroke,
}: {
  className?: string
  stroke?: string
}) {
  return (
    <g
      fill="none"
      stroke={stroke}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(4.5 4.5) scale(0.96)"
      className={className}
    >
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </g>
  )
}
