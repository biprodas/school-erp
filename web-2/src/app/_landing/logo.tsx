import Link from "next/link"

import { KampasyMark } from "~/components/brand/kampasy-mark"
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
      <KampasyMark />
      Kampasy
    </Link>
  )
}
