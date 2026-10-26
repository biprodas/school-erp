import type { SchoolHome } from "../api"

const HEX = /^#[0-9a-f]{6}$/i

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const LIGHT_TEXT = "oklch(0.985 0.005 106)"
const DARK_TEXT = "oklch(0.2 0.03 165)"

/**
 * Paints `.school-home` (the public home page) in the school's primary
 * color: buttons, accents and the hero tint follow it. At night the color
 * is lightened so it still reads on the dark background. Nothing changes
 * when the school hasn't picked a color.
 */
export function SchoolTheme({ colors }: { colors: SchoolHome["colors"] }) {
  const primary = colors.primary
  // The backend checks the format; this keeps anything else out of the CSS.
  if (!primary || !HEX.test(primary)) return null
  const foreground = luminance(primary) > 0.4 ? DARK_TEXT : LIGHT_TEXT
  const night = `color-mix(in oklch, ${primary} 60%, white)`
  const css = [
    `.school-home{--primary:${primary};--primary-foreground:${foreground};--ring:${primary}}`,
    `.dark .school-home{--primary:${night};--primary-foreground:${DARK_TEXT};--ring:${night}}`,
  ].join("")
  return <style>{css}</style>
}
