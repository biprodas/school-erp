"use client"

import { LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { apiFetch } from "~/lib/api/client"

/**
 * Signs out (`POST /api/session/logout`) and reloads `/login`. A full page
 * load on purpose: it drops everything cached for the ended session. The
 * cookie is gone even when the backend can't be reached.
 */
export function SignOutButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost" | "default"
  className?: string
}) {
  const t = useTranslations("common")
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      await apiFetch("/session/logout", { method: "POST", body: {} })
    } catch (error) {
      console.warn("[auth] sign-out answered with an error", error)
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login")
  }

  return (
    <Button
      variant={variant}
      size="lg"
      className={className}
      disabled={pending}
      onClick={signOut}
    >
      {pending ? <Spinner /> : <LogOutIcon />}
      {t("signOut")}
    </Button>
  )
}
