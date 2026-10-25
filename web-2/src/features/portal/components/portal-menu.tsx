"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { KeyRoundIcon, LogOutIcon, SchoolIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { meQuery } from "~/features/auth/api"
import { portalHandoff, portalSchoolsQuery } from "~/features/portal/api"
import { InitialsAvatar } from "~/components/common/initials-avatar"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { toast } from "~/components/ui/toast"
import { signOut } from "~/features/auth/sign-out"
import type { SessionUser } from "~/lib/auth/types"

/**
 * The portal's account menu: who is signed in, their children at other
 * schools (moving there signs in without a password, `POST
 * /portal/handoff`), change password and sign out.
 */
export function PortalMenu({ fallbackUser }: { fallbackUser: SessionUser }) {
  const t = useTranslations("portal.menu")
  const me = useQuery(meQuery())
  const schools = useQuery(portalSchoolsQuery())
  const [signingOut, setSigningOut] = useState(false)

  const user = me.data ?? fallbackUser
  const name = user.name ?? user.email ?? user.phone ?? ""
  const contact = user.email ?? user.phone

  const move = useMutation({
    mutationFn: portalHandoff,
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
    onError: () =>
      toast.add({ title: t("switchFailed"), type: "error", timeout: 6000 }),
  })

  function leave(everywhere: boolean) {
    setSigningOut(true)
    void signOut({ everywhere })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t("label", { name })}
          />
        }
      >
        <InitialsAvatar name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5 text-foreground">
            <span className="truncate text-sm font-medium">{name}</span>
            {contact && contact !== name && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {contact}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {schools.data && schools.data.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("otherSchools")}</DropdownMenuLabel>
              {schools.data.map((school) => (
                <DropdownMenuItem
                  key={school.orgId}
                  disabled={move.isPending}
                  onClick={() => move.mutate(school.orgId)}
                  className="items-start"
                >
                  <SchoolIcon className="mt-0.5" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{school.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {school.children.map((c) => c.name).join(", ")}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link href="/change-password?next=/student" />}
          >
            <KeyRoundIcon />
            {t("changePassword")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={signingOut} onClick={() => leave(false)}>
            <LogOutIcon />
            {t("signOut")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onClick={() => leave(true)}
          >
            <LogOutIcon />
            {t("signOutEverywhere")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
