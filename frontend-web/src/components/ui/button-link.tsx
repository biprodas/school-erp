import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

type Variant = "primary" | "outline" | "accent" | "outline-light";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest-2 text-white hover:bg-forest-hover",
  outline: "bg-paper text-ink ring-1 ring-inset ring-line-strong hover:ring-ink-3",
  accent: "bg-marigold text-ink hover:bg-marigold-hover",
  "outline-light": "text-white ring-1 ring-inset ring-white/30 hover:bg-white/10",
};

type ButtonLinkProps = ComponentProps<"a"> & {
  variant?: Variant;
  size?: "md" | "lg";
  /** Trailing arrow that nudges right on hover, for "go somewhere" actions like signup. */
  arrow?: boolean;
};

/** A link styled as a button. Every CTA on the landing page navigates. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  arrow = false,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  const sizing = size === "lg" ? "h-12 px-6 text-[17px]" : "h-10 px-5 text-[15px]";
  return (
    <a
      className={`group inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
      {arrow ? (
        <ArrowRight
          className={`${size === "lg" ? "size-[18px]" : "size-4"} transition-transform duration-200 group-hover:translate-x-0.5`}
          aria-hidden="true"
        />
      ) : null}
    </a>
  );
}
