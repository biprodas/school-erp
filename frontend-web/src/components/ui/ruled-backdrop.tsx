type RuledBackdropProps = {
  /** Where the soft glow sits, as a CSS position ("82% 40%"). */
  glowAt: string;
  /** Glow colour, as "r, g, b". */
  glow?: string;
  /** Colour of the ruled lines, as "r, g, b, alpha". */
  rule?: string;
  /** Where the ruling is strongest before it fades out. */
  focusAt?: string;
  /** Fade the bottom edge into this colour (a Tailwind `to-*` class). */
  fadeTo?: string;
};

/**
 * Soft light over faint exercise-book ruling that fades out towards the edges.
 * Place inside a `relative isolate overflow-hidden` parent; it sits behind
 * the content and is CSS only, so it costs nothing on a slow connection.
 */
export function RuledBackdrop({
  glowAt,
  glow = "212, 228, 217",
  rule = "20, 63, 48, 0.08",
  focusAt = "50% 35%",
  fadeTo,
}: RuledBackdropProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(55% 75% at ${glowAt}, rgb(${glow}) 0%, rgba(${glow}, 0) 72%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(${rule}) 47px, rgba(${rule}) 48px)`,
          maskImage: `radial-gradient(75% 65% at ${focusAt}, black, transparent)`,
          WebkitMaskImage: `radial-gradient(75% 65% at ${focusAt}, black, transparent)`,
        }}
      />
      {fadeTo ? (
        <div className={`absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent ${fadeTo}`} />
      ) : null}
    </div>
  );
}
