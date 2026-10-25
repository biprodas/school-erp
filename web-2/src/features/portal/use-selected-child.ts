"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { childrenQuery, selectedChild } from "~/features/portal/api"

/**
 * The children the user may see and the one the URL selects (`?child=`,
 * else the first). The choice lives in the URL so a link, a reload or the
 * back button keeps it.
 */
export function useSelectedChild() {
  const children = useQuery(childrenQuery())
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const child = children.data
    ? selectedChild(children.data, params.get("child"))
    : null

  function select(studentId: string) {
    const next = new URLSearchParams(params)
    next.set("child", studentId)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return { children, child, select }
}
