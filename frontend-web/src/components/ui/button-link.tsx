import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { buttonVariants } from "./button";

type ButtonLinkProps = ComponentProps<"a"> &
  VariantProps<typeof buttonVariants> & {
    /** Trailing arrow that nudges right on hover, for "go somewhere" actions like signup. */
    arrow?: boolean;
  };

/**
 * A link styled as a `Button`. Every CTA on the landing page navigates, so it
 * renders a plain `<a>` with the button's variants and stays a server component.
 */
export function ButtonLink({
  variant,
  size,
  arrow = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
      {arrow ? (
        <ArrowRight
          data-icon="inline-end"
          className="transition-transform duration-200 group-hover/button:translate-x-0.5"
          aria-hidden="true"
        />
      ) : null}
    </a>
  );
}
