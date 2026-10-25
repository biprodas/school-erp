"use client"

import { LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { BrandMark } from "~/components/brand/brand-mark"
import { LanguageSwitch } from "~/components/language-switch"
import { ThemeToggle } from "~/components/theme-toggle"
import { InitialsAvatar } from "~/components/initials-avatar"
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
import { BRAND } from "~/config/brand-config"
import { signOut } from "~/features/auth/sign-out"
import type { SessionUser } from "~/lib/auth/types"

/**
 * The platform console around every admin page. Only a header for now:
 * the brand, language, theme and the account menu; the platform screens
 * (schools, plans, users, audit) bring their navigation with them.
 */
export function AdminShell({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  const t = useTranslations("admin")
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
          <BrandMark className="size-7" />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {t("title", { brand: BRAND.name })}
          </span>
          <LanguageSwitch compact />
          <ThemeToggle />
          <AdminMenu user={user} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  )
}

function AdminMenu({ user }: { user: SessionUser }) {
  const t = useTranslations("admin.menu")
  const [signingOut, setSigningOut] = useState(false)
  const name = user.name ?? user.email ?? user.phone ?? ""
  const contact = user.email ?? user.phone

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
      <DropdownMenuContent align="end" className="w-64">
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
            <LogOutIcon />
            {t("signOutEverywhere")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
