import { BanIcon, CircleCheckIcon, ClockIcon } from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getLocale, getTranslations } from "next-intl/server"

import {
  getSchoolHome,
  schoolName,
  type SchoolHome,
} from "~/features/school-site/api"
import { ActivateForm } from "~/features/auth/components/activate-form"
import { readToken } from "~/features/auth/server/check-token"
import { InvitationCard } from "~/features/auth/components/invitation-card"
import { SwitchAccount } from "~/features/auth/components/switch-account"
import { LinkProblem } from "~/features/auth/components/link-problem"
import { param, type SearchParams } from "~/features/auth/search-params"
import { getSession, type SessionUser } from "~/lib/auth"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.activate")
  return { title: t("metaTitle") }
}

/** `GET /auth/activate` (AuthService.verifyActivation). */
interface Invitation {
  email: string | null
  phone: string | null
  name: string | null
  hasPassword: boolean
  isAdmin: boolean
  /** Role names in this school (system ones are translated). */
  roles: string[]
  expiresAt: string
}

/**
 * `/activate?token=`: the link in an invitation email. Shows who the
 * invitation is for and what they'll be in the school, then asks for a
 * password (a new one, or the account's own). Looking doesn't use the
 * link. A link that doesn't work says why and what to do instead.
 */
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const home = await getSchoolHome(await requireSchoolSlug())
  const school = schoolName(home, await getLocale())
  const token = await param(searchParams, "token")
  const read = token
    ? await readToken<Invitation>("/auth/activate", token)
    : { refused: "LINK_INVALID" }

  if (!token || "refused" in read) {
    return <Refused code={"refused" in read ? read.refused : ""} home={home} />
  }

  const invitation = read.data
  const account = invitation.email ?? invitation.phone ?? ""
  const format = await getFormatter()
  const t = await getTranslations("auth.activate")
  // Someone else signed in here would end up signed in as the invitee.
  const session = await getSession()
  const other =
    session && !isInvitee(session.user, invitation) ? session.user : null
  const step = other
    ? {
        title: t("otherAccountTitle"),
        description: t("otherAccountHint"),
      }
    : invitation.hasPassword
      ? { title: t("enterPassword"), description: t("existingDescription") }
      : { title: t("choosePassword"), description: t("chooseHint") }
  return (
    <InvitationCard
      school={school}
      name={invitation.name ?? account}
      account={account}
      roles={invitation.roles}
      isAdmin={invitation.isAdmin}
      step={step}
      validUntil={format.dateTime(new Date(invitation.expiresAt), {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    >
      {other ? (
        <SwitchAccount
          current={other.email ?? other.phone ?? other.name ?? ""}
          invitee={account}
        />
      ) : (
        <ActivateForm
          token={token}
          account={account}
          hasPassword={invitation.hasPassword}
        />
      )}
    </InvitationCard>
  )
}

/**
 * Whether the signed-in account is the one invited: the same email (the
 * backend stores both normalized) or, for a phone-only account, phone.
 */
function isInvitee(user: SessionUser, invitation: Invitation): boolean {
  if (invitation.email && user.email) {
    return invitation.email.toLowerCase() === user.email.toLowerCase()
  }
  return Boolean(invitation.phone) && invitation.phone === user.phone
}

/** Why the link doesn't work, and the way on from there. */
async function Refused({ code, home }: { code: string; home: SchoolHome }) {
  const t = await getTranslations("auth.activate")
  const school = schoolName(home, await getLocale())
  const signIn = { href: "/login", label: t("signIn") }
  // Someone who hasn't accepted yet can't sign in: the school's page has
  // its contact details.
  const schoolPage = { href: "/", label: t("schoolPage", { school }) }
  const contact = [home.contact?.phone, home.contact?.email]
    .filter(Boolean)
    .join(", ")
  const askSchool = contact && (
    <p className="text-sm text-muted-foreground">
      {t("contact", { school, contact })}
    </p>
  )

  if (code === "LINK_USED") {
    return (
      <LinkProblem
        icon={CircleCheckIcon}
        title={t("usedTitle")}
        body={t("usedBody")}
        action={signIn}
      />
    )
  }
  if (code === "LINK_EXPIRED") {
    return (
      <LinkProblem
        icon={ClockIcon}
        title={t("expiredTitle")}
        body={t("expiredBody", { school })}
        action={schoolPage}
      >
        {askSchool}
      </LinkProblem>
    )
  }
  if (code.startsWith("MEMBERSHIP_")) {
    return (
      <LinkProblem
        icon={BanIcon}
        title={t("endedTitle", { school })}
        body={t("endedBody")}
        action={schoolPage}
      >
        {askSchool}
      </LinkProblem>
    )
  }
  return (
    <LinkProblem
      title={t("invalidTitle")}
      body={t("invalidBody")}
      action={schoolPage}
    >
      {askSchool}
    </LinkProblem>
  )
}
