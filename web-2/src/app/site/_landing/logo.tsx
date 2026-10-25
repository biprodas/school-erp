import Link from "next/link"

import { BrandMark } from "~/components/brand/brand-mark"
import { BRAND } from "~/config/brand-config"
import { cn } from "~/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 text-xl font-bold tracking-tight",
        className
      )}
    >
      <BrandMark />
      {BRAND.name}
    </Link>
  )
}
