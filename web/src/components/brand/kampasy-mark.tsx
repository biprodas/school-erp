import { cn } from "~/lib/utils";

/**
 * The Kampasy mark: a "K" whose upper arm reaches for a highlight dot.
 * Keep in sync with `app/icon.svg` and `app/apple-icon.tsx`.
 */
export function KampasyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <g fill="none" stroke="white" strokeWidth="4" strokeLinecap="round">
        <path d="M10.5 8.5v15M12.5 16l5-5M13.5 15.5l7 8" />
      </g>
      <circle cx="21.75" cy="7.75" r="2.6" className="fill-highlight" />
    </svg>
  );
}
