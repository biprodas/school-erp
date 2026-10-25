import { ImageResponse } from "next/og"

import { SchoolErpGlyph } from "~/components/brand/school-erp-mark"
import { BRAND } from "~/config/brand-config"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// The active brand's mark (as in app/icon.svg) in the light theme's
// colors, full-bleed: iOS applies its own corner mask.
export default function AppleIcon() {
  return new ImageResponse(
    <svg width="180" height="180" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#1B503A" />
      {BRAND.id === "kampasy" ? (
        <g>
          <path
            d="M10.5 8.5v15M12.5 16l5-5M13.5 15.5l7 8"
            fill="none"
            stroke="#FAFAF7"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="21.75" cy="7.75" r="2.6" fill="#F0B04F" />
        </g>
      ) : (
        // Called, not rendered: ImageResponse only takes plain SVG elements.
        SchoolErpGlyph({ stroke: "#FAFAF7" })
      )}
    </svg>,
    size
  )
}
