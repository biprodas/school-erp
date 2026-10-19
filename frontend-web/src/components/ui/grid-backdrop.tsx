type GridBackdropProps = {
  /** Size of each grid square in px. */
  cell?: number;
  /** Line colour, as "r, g, b, alpha". */
  line?: string;
  /** Where the grid is strongest before it fades out, as a CSS position. */
  focusAt?: string;
  /** Where a soft glow sits under the grid, as a CSS position. Omit for no glow. */
  glowAt?: string;
  /** Glow colour, as "r, g, b". */
  glow?: string;
};

/**
 * A faint square grid, like graph paper, that fades out towards the edges,
 * with an optional soft glow underneath. Place inside a
 * `relative isolate overflow-hidden` parent; it sits behind the content and is
 * CSS only, so it costs nothing on a slow connection.
 */
export function GridBackdrop({
  cell = 48,
  line = "20, 63, 48, 0.07",
  focusAt = "50% 40%",
  glowAt,
  glow = "212, 228, 217",
}: GridBackdropProps) {
  const mask = `radial-gradient(70% 70% at ${focusAt}, black 30%, transparent 100%)`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {glowAt ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(55% 75% at ${glowAt}, rgb(${glow}) 0%, rgba(${glow}, 0) 72%)`,
          }}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(${line}) 1px, transparent 1px), linear-gradient(to bottom, rgba(${line}) 1px, transparent 1px)`,
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: "center top",
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
    </div>
  );
}
