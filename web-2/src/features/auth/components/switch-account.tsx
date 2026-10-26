"use client"

import { LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

import { signOut } from "../sign-out"

/**
 * An invitation opened while another account is signed in here. Accepting
 * it would sign this browser in as the invitee, so it offers to sign out
 * first and come back to the same link.
 */
export function SwitchAccount({
  current,
  invitee,
}: {
  current: string
  invitee: string
}) {
  const t = useTranslations("auth.activate")
  const [pending, setPending] = useState(false)

  function onClick() {
    setPending(true)
    void signOut({ to: window.location.pathname + window.location.search })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {t.rich("otherAccountBody", {
          current,
          invitee,
          b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
        })}
      </p>
      <Button size="lg" disabled={pending} onClick={onClick}>
        {pending ? <Spinner /> : <LogOutIcon />}
        {t("otherAccountAction")}
      </Button>
    </div>
  )
}
