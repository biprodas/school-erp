"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"

/**
 * "Find your school" at the end of the signup header, for someone whose
 * school already exists. The find-school pages offer signup as a quiet
 * line under the form instead, so the header doesn't pull them away.
 */
export function AccountHeaderLink() {
  const t = useTranslations("findSchool")
  if (!usePathname().startsWith("/signup")) return null

  return (
    <a
      href="/find-school"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "ml-1 hidden sm:inline-flex"
      )}
    >
      {t("title")}
    </a>
  )
}
