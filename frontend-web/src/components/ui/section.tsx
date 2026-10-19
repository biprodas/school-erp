import type { ReactNode } from "react";

const TONES = {
  canvas: "bg-canvas",
  paper: "bg-paper",
  mint: "bg-mint",
  forest: "bg-forest text-white",
} as const;

type SectionProps = {
  id?: string;
  labelledBy: string;
  tone?: keyof typeof TONES;
  className?: string;
  /** Decoration drawn behind the content, e.g. a `GridBackdrop`. */
  backdrop?: ReactNode;
  children: ReactNode;
};

/** A full-width band with the shared container and vertical rhythm. */
export function Section({
  id,
  labelledBy,
  tone = "canvas",
  className = "",
  backdrop,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`border-t border-line ${TONES[tone]} ${tone === "forest" ? "border-forest" : ""} ${backdrop ? "relative isolate overflow-hidden" : ""}`}
    >
      {backdrop}
      <div className={`mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28 ${className}`}>{children}</div>
    </section>
  );
}

type SectionHeadingProps = {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  dark?: boolean;
  className?: string;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  align = "left",
  dark = false,
  className = "",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={`${centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow ? (
        <p className={`mb-4 text-[15px] font-semibold ${dark ? "text-marigold" : "text-forest-2"}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2 id={id} className="display text-[2.6rem] text-balance sm:text-[3.4rem] lg:text-[3.75rem]">
        {title}
      </h2>
      {children ? (
        <div className={`mt-5 text-lg leading-relaxed ${dark ? "text-white/75" : "text-ink-2"}`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
