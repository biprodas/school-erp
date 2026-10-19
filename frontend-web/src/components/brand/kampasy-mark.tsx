/**
 * The Kampasy mark: a "K" whose upper arm reaches for a highlight dot.
 * Same mark as `web/`; keep in sync with `app/icon.svg` and `app/apple-icon.tsx`.
 */
export function KampasyMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="8" fill="#0F5B3C" />
      <g fill="none" stroke="white" strokeWidth="4" strokeLinecap="round">
        <path d="M10.5 8.5v15M12.5 16l5-5M13.5 15.5l7 8" />
      </g>
      <circle cx="21.75" cy="7.75" r="2.6" fill="#F3AE3D" />
    </svg>
  );
}
