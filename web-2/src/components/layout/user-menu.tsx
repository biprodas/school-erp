"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  ArrowLeftRightIcon,
  KeyRoundIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
  SchoolIcon,
  UserIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { meQuery, otherSchoolsQuery, switchSchool } from "~/api/auth"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { toast } from "~/components/ui/toast"
import { signOut } from "~/features/auth/sign-out"
import { initials } from "~/lib/initials"
import type { SessionUser } from "~/lib/session/types"

import { useRoleLabel } from "./role-label"

/**
 * The account menu: who is signed in and with which roles, the account
 * page, other schools of the same account, and signing out (here or
 * everywhere).
 */
export function UserMenu({ fallbackUser }: { fallbackUser: SessionUser }) {
  const t = useTranslations("shell.userMenu")
  const roleLabel = useRoleLabel()
  const me = useQuery(meQuery())
  const schools = useQuery(otherSchoolsQuery())
  const [signingOut, setSigningOut] = useState(false)

  const user = me.data ?? fallbackUser
  const name = user.name ?? user.email ?? user.phone ?? ""
  const contact = user.email ?? user.phone
  const roles = user.isAdmin
    ? ["admin", ...user.roles.filter((role) => role !== "admin")]
    : user.roles

  const move = useMutation({
    mutationFn: switchSchool,
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
        <Avatar className="size-8">
          <AvatarFallback className="text-xs font-medium">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1.5 px-2 py-1.5 text-foreground">
            <span className="truncate text-sm font-medium">{name}</span>
            {contact && contact !== name && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {contact}
              </span>
            )}
            {roles.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {roleLabel(role)}
                  </Badge>
                ))}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/dashboard/account" />}>
            <UserIcon />
            {t("account")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href="/change-password?next=/dashboard/account" />}
          >
            <KeyRoundIcon />
            {t("changePassword")}
          </DropdownMenuItem>
          {schools.data && schools.data.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={move.isPending}>
                <ArrowLeftRightIcon />
                {t("switchSchool")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {schools.data.map((school) => (
                  <DropdownMenuItem
                    key={school.orgId}
                    disabled={move.isPending}
                    onClick={() => move.mutate(school.orgId)}
                  >
                    <SchoolIcon />
                    <span className="truncate">{school.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={signingOut} onClick={() => leave(false)}>
            <LogOutIcon />
            {t("signOut")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onClick={() => leave(true)}
          >
            <MonitorSmartphoneIcon />
            {t("signOutEverywhere")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
