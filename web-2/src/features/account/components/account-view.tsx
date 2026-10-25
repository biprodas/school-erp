"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  KeyRoundIcon,
  MonitorSmartphoneIcon,
} from "lucide-react"
import Link from "next/link"
import { useFormatter, useNow, useTranslations } from "next-intl"

import {
  authKeys,
  endSession,
  meQuery,
  sessionsQuery,
  startGoogleLink,
  unlinkGoogle,
  type AccountSession,
  type Me,
} from "~/features/auth/api"
import { useRoleLabel } from "~/features/shell/role-label"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button, buttonVariants } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/components/ui/toast"
import { GoogleIcon } from "~/features/auth/components/google-icon"
import { signOut } from "~/features/auth/sign-out"
import { isApiError } from "~/lib/api/errors"

import { describeUserAgent } from "../user-agent"

export const ACCOUNT_PATH = "/dashboard/account"

/**
 * `/dashboard/account`: who the member is, their password, where they are
 * signed in, and Google sign-in.
 */
export function AccountView({
  googleEnabled,
  notice,
}: {
  googleEnabled: boolean
  /** From the Google round trip (`?google=linked`, `?google_error=`). */
  notice: { type: "success" | "error"; message: string } | null
}) {
  const me = useQuery(meQuery())

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {notice && (
        <Alert
          variant={notice.type === "error" ? "destructive" : "default"}
          aria-live="polite"
        >
          {notice.type === "error" ? <CircleAlertIcon /> : <CircleCheckIcon />}
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}
      {me.data ? (
        <ProfileCard me={me.data} />
      ) : (
        <Skeleton className="h-40 rounded-xl" />
      )}
      <PasswordCard />
      <SessionsCard />
      {me.data && (googleEnabled || hasGoogle(me.data)) && (
        <GoogleCard me={me.data} enabled={googleEnabled} />
      )}
    </div>
  )
}

const hasGoogle = (me: Me) =>
  me.identities.some((identity) => identity.provider === "google")

function ProfileCard({ me }: { me: Me }) {
  const t = useTranslations("shell.account")
  const roleLabel = useRoleLabel()
  const roles = me.isAdmin
    ? ["admin", ...me.roles.filter((role) => role !== "admin")]
    : me.roles
  const rows: [string, React.ReactNode][] = [
    [t("name"), me.name ?? "—"],
    [t("email"), me.email ?? "—"],
    [t("phone"), me.phone ?? "—"],
    [t("school"), me.organization.name ?? me.organization.slug],
    [
      t("roles"),
      roles.length ? (
        <span className="flex flex-wrap gap-1">
          {roles.map((role) => (
            <Badge key={role} variant="secondary">
              {roleLabel(role)}
            </Badge>
          ))}
        </span>
      ) : (
        t("noRoles")
      ),
    ],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("profileTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("profileDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words max-sm:-mt-2">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const t = useTranslations("shell.account")
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("passwordTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("passwordDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href={`/change-password?next=${ACCOUNT_PATH}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <KeyRoundIcon />
          {t("changePassword")}
        </Link>
      </CardContent>
    </Card>
  )
}

function SessionsCard() {
  const t = useTranslations("shell.account")
  const sessions = useQuery(sessionsQuery())

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("sessionsTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("sessionsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : sessions.isError ? (
          <p className="text-sm text-muted-foreground">{t("sessionsFailed")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {sessions.data.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function SessionRow({ session }: { session: AccountSession }) {
  const t = useTranslations("shell.account")
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  const queryClient = useQueryClient()
  const end = useMutation({
    mutationFn: endSession,
    onSuccess: () =>
      toast.add({ title: t("sessionEnded"), type: "success", timeout: 4000 }),
    onError: () =>
      toast.add({ title: t("actionFailed"), type: "error", timeout: 6000 }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: authKeys.sessions }),
  })

  const { browser, os } = describeUserAgent(session.userAgent)
  const device =
    browser && os
      ? t("deviceOn", { browser, os })
      : (browser ?? os ?? t("unknownDevice"))
  const lastUsed = session.lastUsedAt ?? session.createdAt

  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <MonitorSmartphoneIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {device}
          {session.current && <Badge>{t("thisDevice")}</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">
          {[
            session.ip,
            t("lastActive", {
              time: format.relativeTime(new Date(lastUsed), now),
            }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {session.current ? (
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          {t("signOutHere")}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={end.isPending}
          onClick={() => end.mutate(session.id)}
        >
          {end.isPending && <Spinner />}
          {t("endSession")}
        </Button>
      )}
    </li>
  )
}

function GoogleCard({ me, enabled }: { me: Me; enabled: boolean }) {
  const t = useTranslations("shell.account")
  const queryClient = useQueryClient()
  const google = me.identities.find(
    (identity) => identity.provider === "google"
  )

  const link = useMutation({
    mutationFn: () => startGoogleLink(window.location.hostname, ACCOUNT_PATH),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: () =>
      toast.add({ title: t("actionFailed"), type: "error", timeout: 6000 }),
  })
  const unlink = useMutation({
    mutationFn: unlinkGoogle,
    onSuccess: () =>
      toast.add({ title: t("googleUnlinked"), type: "success", timeout: 4000 }),
    onError: (error) =>
      toast.add({
        title:
          isApiError(error) && error.code === "PASSWORD_REQUIRED"
            ? t("googlePasswordRequired")
            : t("actionFailed"),
        type: "error",
        timeout: 8000,
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("googleTitle")}</h2>
        </CardTitle>
        <CardDescription>
          {google
            ? t("googleLinked", { email: google.email ?? "" })
            : t("googleDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {google ? (
          <Button
            variant="outline"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate()}
          >
            {unlink.isPending ? <Spinner /> : <GoogleIcon />}
            {t("googleUnlink")}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={!enabled || link.isPending}
            onClick={() => link.mutate()}
          >
            {link.isPending ? <Spinner /> : <GoogleIcon />}
            {t("googleLink")}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
