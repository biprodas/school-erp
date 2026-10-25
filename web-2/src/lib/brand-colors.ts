const HEX = /^#([0-9a-f]{6})$/i

/** WCAG relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** White or near-black text, whichever reads better on `hex`. */
export function foregroundOn(hex: string): string {
  const l = luminance(hex)
  return contrast(l, 1) >= contrast(l, luminance("#18181b"))
    ? "#ffffff"
    : "#18181b"
}

/**
 * The school's primary color as the shell's CSS variables (buttons, the
 * active sidebar tile, focus rings), with a readable foreground. Nothing
 * when the school hasn't set one, or it isn't `#rrggbb`: the design
 * system's own colors stay.
 */
export function brandStyle(
  primary: string | null | undefined
): Record<string, string> | undefined {
  if (!primary || !HEX.test(primary)) return undefined
  const foreground = foregroundOn(primary)
  return {
    "--primary": primary,
    "--primary-foreground": foreground,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": foreground,
    "--ring": primary,
    "--sidebar-ring": primary,
  }
}
