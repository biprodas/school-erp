import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as app/icon.svg, full-bleed: iOS applies its own corner mask.
export default function AppleIcon() {
  return new ImageResponse(
    <svg width="180" height="180" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#0F5B3C" />
      <path
        d="M10.5 8.5v15M12.5 16l5-5M13.5 15.5l7 8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="21.75" cy="7.75" r="2.6" fill="#F3AE3D" />
    </svg>,
    size,
  );
}
