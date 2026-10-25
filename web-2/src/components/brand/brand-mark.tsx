import { BRAND } from "~/config/brand-config"

import { KampasyMark } from "./kampasy-mark"
import { SchoolErpMark } from "./school-erp-mark"

/** The active brand's mark (`lib/brand.ts`). */
export function BrandMark({ className }: { className?: string }) {
  return BRAND.id === "kampasy" ? (
    <KampasyMark className={className} />
  ) : (
    <SchoolErpMark className={className} />
  )
}
