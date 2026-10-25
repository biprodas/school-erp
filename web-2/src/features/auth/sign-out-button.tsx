"use client"

import { LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

import { signOut } from "./sign-out"

/** Signs out and reloads `/login` (see `signOut`). */
export function SignOutButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost" | "default"
  className?: string
}) {
  const t = useTranslations("common")
  const [pending, setPending] = useState(false)

  function onClick() {
    setPending(true)
    void signOut()
  }

  return (
    <Button
      variant={variant}
      size="lg"
      className={className}
      disabled={pending}
      onClick={onClick}
    >
      {pending ? <Spinner /> : <LogOutIcon />}
      {t("signOut")}
    </Button>
  )
}
