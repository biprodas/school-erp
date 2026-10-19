import Link from "next/link";
import { KampasyMark } from "~/components/brand/kampasy-mark";
import { cn } from "~/lib/utils";

export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6", className)}
      {...props}
    />
  );
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-brand text-xs font-bold tracking-[0.14em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl",
        className,
      )}
      {...props}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("text-ink flex items-center gap-2", className)}
      aria-label="Kampasy home"
    >
      <KampasyMark />
      <span className="font-heading text-xl font-bold tracking-tight">
        Kampasy
      </span>
    </Link>
  );
}

const pillBase =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-6 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export const pill = {
  primary: cn(pillBase, "bg-brand text-white hover:bg-brand/90"),
  outline: cn(
    pillBase,
    "border border-border bg-white text-ink hover:bg-cream",
  ),
  highlight: cn(pillBase, "bg-highlight text-ink hover:bg-highlight/90"),
};
