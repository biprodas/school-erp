"use client"

import { useQuery } from "@tanstack/react-query"
import {
  CheckIcon,
  CopyIcon,
  MailIcon,
  PlusIcon,
  PrinterIcon,
  ScissorsIcon,
  Trash2Icon,
  UserCheckIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import {
  createStaffMember,
  deleteStaffMember,
  inviteStaffMember,
  onboardingKeys,
  staffQuery,
  staffRolesQuery,
  type SchoolRole,
  type StaffInviteResult,
  type StaffMember,
} from "~/features/onboarding/api"
import { displayName, displaySettingsQuery } from "~/features/settings/api"
import { ariaFor, FormField } from "~/components/forms/form-field"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Spinner } from "~/components/ui/spinner"
import { useRoleLabel } from "~/features/shell/role-label"

import { StepLoadFailed, StepNote } from "./step-parts"
import { useSetupAction } from "../use-setup-action"

const staffKey = onboardingKeys.staff

/** Printing the slip prints only the slip, about postcard size. */
const PRINT_SLIP_CSS =
  "@media print { body * { visibility: hidden } [data-print-slip], [data-print-slip] * { visibility: visible } [data-print-slip] { position: absolute; inset: 1cm auto auto 1cm; width: 12cm } }"
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A one-time password to hand over, and who it is for. */
interface Slip {
  name: string
  phone: string
  password: string
}

/**
 * Step 7 (optional): staff records and their logins. Add someone (and
 * invite them right away, with a role), invite anyone added earlier, or
 * remove them. Phone-only staff get a one-time password, shown once as a
 * slip to print or copy and hand over.
 */
export function StaffStep() {
  const t = useTranslations("onboarding.staff")
  const staff = useQuery(staffQuery())
  const roles = useQuery(staffRolesQuery())
  const [slip, setSlip] = useState<Slip | null>(null)

  if (staff.isPending || roles.isPending) {
    return <Skeleton className="h-48 rounded-lg" />
  }
  if (staff.isError || roles.isError) {
    return (
      <StepLoadFailed
        retry={() => Promise.all([staff.refetch(), roles.refetch()])}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {slip && <SignInSlip slip={slip} onDone={() => setSlip(null)} />}
      <Section
        title={t("yours", { count: staff.data.length })}
        hint={t("yoursHint")}
      >
        {staff.data.length === 0 ? (
          <StepNote tone="info">{t("empty")}</StepNote>
        ) : (
          <ul
            className="flex flex-col divide-y rounded-lg border"
            aria-label={t("listLabel")}
          >
            {staff.data.map((member) => (
              <StaffRow
                key={member.id}
                member={member}
                roles={roles.data}
                onSlip={setSlip}
              />
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("addTitle")} hint={t("addHint")}>
        <AddStaffForm roles={roles.data} onSlip={setSlip} />
      </Section>
    </div>
  )
}

/** A heading in the left column on wide screens, ruled off from the last. */
function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t pt-6 first:border-t-0 first:pt-0 lg:flex">
      <div className="mb-3 flex flex-col gap-0.5 lg:mb-0 lg:w-44 lg:shrink-0 lg:pr-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

/** Teacher first: most staff a school adds are teachers. */
const defaultRole = (roles: SchoolRole[]) =>
  roles.find((r) => r.name === "teacher")?.id ?? roles[0]?.id ?? ""

/** The toast (or slip) after an invite, by how it went out. */
function useInviteOutcome(onSlip: (slip: Slip) => void) {
  const t = useTranslations("onboarding.staff")
  return (member: StaffMember, result: StaffInviteResult) => {
    if (result.delivery === "slip") {
      onSlip({
        name: member.fullName,
        phone: member.phone ?? "",
        password: result.temporaryPassword,
      })
      return
    }
    toast.add({
      title:
        result.delivery === "email"
          ? t("inviteEmailed", {
              name: member.fullName,
              email: member.email ?? "",
            })
          : t("inviteExisting", { name: member.fullName }),
      type: "success",
      timeout: 6000,
    })
  }
}

/** One person: name, contact, login state, invite (with a role), remove. */
function StaffRow({
  member,
  roles,
  onSlip,
}: {
  member: StaffMember
  roles: SchoolRole[]
  onSlip: (slip: Slip) => void
}) {
  const t = useTranslations("onboarding.staff")
  const roleLabel = useRoleLabel()
  const [roleId, setRoleId] = useState(() => defaultRole(roles))
  const outcome = useInviteOutcome(onSlip)
  const invite = useSetupAction({
    action: () => inviteStaffMember(member.id, roleId),
    invalidate: [staffKey],
    success: null,
    onSuccess: (result) => outcome(member, result),
  })
  const remove = useSetupAction({
    action: () => deleteStaffMember(member.id),
    invalidate: [staffKey],
    success: () => t("removed", { name: member.fullName }),
  })
  const contact = [member.phone, member.email].filter(Boolean).join(", ")
  const busy = invite.isPending || remove.isPending

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{member.fullName}</span>
          {member.employeeNumber && (
            <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
              {member.employeeNumber}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground sm:truncate">
          {contact || t("noContact")}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {member.userId ? (
          <Badge variant="secondary" className="h-7 px-2.5">
            <UserCheckIcon aria-hidden />
            {t("hasLogin")}
          </Badge>
        ) : contact ? (
          <>
            <NativeSelect
              size="sm"
              aria-label={t("roleFor", { name: member.fullName })}
              value={roleId}
              disabled={busy}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-36"
            >
              {roles.map((role) => (
                <NativeSelectOption key={role.id} value={role.id}>
                  {roleLabel(role.name)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !roleId}
              aria-label={t("inviteName", { name: member.fullName })}
              onClick={() => invite.mutate(undefined)}
            >
              {invite.isPending ? <Spinner /> : <MailIcon aria-hidden />}
              {t("invite")}
            </Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("remove", { name: member.fullName })}
          title={t("remove", { name: member.fullName })}
          disabled={busy}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => remove.mutate(undefined)}
        >
          {remove.isPending ? <Spinner /> : <Trash2Icon aria-hidden />}
        </Button>
      </span>
    </li>
  )
}

/** Name, contact and role; invited at once unless unticked. */
function AddStaffForm({
  roles,
  onSlip,
}: {
  roles: SchoolRole[]
  onSlip: (slip: Slip) => void
}) {
  const t = useTranslations("onboarding.staff")
  const roleLabel = useRoleLabel()
  const empty = { firstName: "", lastName: "", phone: "", email: "" }
  const [values, setValues] = useState(empty)
  const [roleId, setRoleId] = useState(() => defaultRole(roles))
  const [inviteNow, setInviteNow] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const outcome = useInviteOutcome(onSlip)

  const add = useSetupAction({
    // The record first; the invite after, so a failed invite still leaves
    // the person in the list to invite again.
    action: async (body: typeof values & { invite: boolean }) => {
      const member = await createStaffMember({
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone || undefined,
        email: body.email || undefined,
      })
      const invited = body.invite
        ? await inviteStaffMember(member.id, roleId)
        : null
      return { member, invited }
    },
    invalidate: [staffKey],
    success: null,
    onSuccess: ({ member, invited }) => {
      setValues(empty)
      if (invited) outcome(member, invited)
      else
        toast.add({
          title: t("added", { name: member.fullName }),
          type: "success",
          timeout: 4000,
        })
    },
  })

  const set = (name: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }))

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const v = Object.fromEntries(
      Object.entries(values).map(([k, x]) => [k, x.trim()])
    ) as typeof values
    const next: Partial<Record<string, string>> = {}
    if (!v.firstName) next.firstName = t("firstNameRequired")
    if (!v.lastName) next.lastName = t("lastNameRequired")
    if (v.email && !EMAIL.test(v.email)) next.email = t("emailInvalid")
    if (inviteNow && !v.phone && !v.email) next.phone = t("contactRequired")
    setErrors(next)
    if (Object.keys(next).length) return
    add.mutate({ ...v, invite: inviteNow })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="staff-firstName"
          label={t("firstName")}
          error={errors.firstName}
        >
          <Input
            id="staff-firstName"
            value={values.firstName}
            onChange={(e) => set("firstName")(e.target.value)}
            maxLength={100}
            autoComplete="off"
            placeholder={t("firstNamePlaceholder")}
            {...ariaFor("staff-firstName", errors.firstName)}
          />
        </FormField>
        <FormField
          id="staff-lastName"
          label={t("lastName")}
          error={errors.lastName}
        >
          <Input
            id="staff-lastName"
            value={values.lastName}
            onChange={(e) => set("lastName")(e.target.value)}
            maxLength={100}
            autoComplete="off"
            placeholder={t("lastNamePlaceholder")}
            {...ariaFor("staff-lastName", errors.lastName)}
          />
        </FormField>
        <FormField id="staff-phone" label={t("phone")} error={errors.phone}>
          <Input
            id="staff-phone"
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => set("phone")(e.target.value)}
            maxLength={32}
            autoComplete="off"
            placeholder={t("phonePlaceholder")}
            {...ariaFor("staff-phone", errors.phone)}
          />
        </FormField>
        <FormField id="staff-email" label={t("email")} error={errors.email}>
          <Input
            id="staff-email"
            type="email"
            value={values.email}
            onChange={(e) => set("email")(e.target.value)}
            maxLength={254}
            autoComplete="off"
            placeholder={t("emailPlaceholder")}
            {...ariaFor("staff-email", errors.email)}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
        <Label className="flex flex-1 items-start gap-2 text-sm font-normal">
          <Checkbox
            checked={inviteNow}
            onCheckedChange={(checked) => setInviteNow(checked === true)}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t("inviteNow")}</span>
            <span className="text-xs text-muted-foreground">
              {t("inviteNowHint")}
            </span>
          </span>
        </Label>
        <NativeSelect
          aria-label={t("role")}
          value={roleId}
          disabled={!inviteNow}
          onChange={(e) => setRoleId(e.target.value)}
          className="sm:w-44"
        >
          {roles.map((role) => (
            <NativeSelectOption key={role.id} value={role.id}>
              {roleLabel(role.name)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <Button
        type="submit"
        disabled={add.isPending}
        className="self-start max-sm:w-full"
      >
        {add.isPending ? <Spinner /> : <PlusIcon aria-hidden />}
        {inviteNow ? t("addAndInvite") : t("add")}
      </Button>
    </form>
  )
}

/**
 * The one-time password for phone-only staff, as a sign-in slip to tear
 * off and hand over: the school, who it is for, their phone and the
 * password. Shown only now; printing prints just the slip.
 */
function SignInSlip({ slip, onDone }: { slip: Slip; onDone: () => void }) {
  const t = useTranslations("onboarding.staff")
  const locale = useLocale()
  const display = useQuery(displaySettingsQuery())
  const school = display.data ? displayName(display.data, locale) : ""
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard
      ?.writeText(slip.password)
      .then(() => setCopied(true))
      .catch(() => undefined)
  }

  return (
    <section
      role="region"
      aria-label={t("slipLabel", { name: slip.name })}
      className="flex flex-col gap-3"
    >
      <div
        // Printing shows this alone (PRINT_SLIP_CSS hides the rest).
        data-print-slip
        className="relative rounded-md border-2 border-dashed border-muted-foreground/40 bg-card p-5"
      >
        <ScissorsIcon
          aria-hidden
          className="absolute -top-2.5 left-4 size-4 bg-card px-0.5 text-muted-foreground"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{school}</span>
            <span className="font-semibold">{t("slipTitle")}</span>
            <span className="text-sm">
              {slip.name}
              {slip.phone && (
                <span className="text-muted-foreground"> · {slip.phone}</span>
              )}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 sm:items-end">
            <span className="text-xs text-muted-foreground">
              {t("slipPassword")}
            </span>
            <span className="font-mono text-2xl font-semibold tracking-wider select-all">
              {slip.password}
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("slipHint")}</p>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <PrinterIcon aria-hidden />
          {t("print")}
        </Button>
        <Button size="sm" onClick={onDone}>
          {t("slipDone")}
        </Button>
      </div>
      <style>{PRINT_SLIP_CSS}</style>
      <span className="sr-only" role="status">
        {t("slipAnnounce", { name: slip.name })}
      </span>
    </section>
  )
}
