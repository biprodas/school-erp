"use client"

import { useQuery } from "@tanstack/react-query"
import {
  BookOpenIcon,
  GlobeIcon,
  GraduationCapIcon,
  ImageUpIcon,
  PresentationIcon,
  SchoolIcon,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState, type FormEvent } from "react"

import { SCHOOL_TYPES, type SchoolType } from "~/features/onboarding/api"
import {
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  schoolSettingsQuery,
  settingsKeys,
  updateOrganizationSettings,
  updateProfileSettings,
  uploadLogo,
  type ProfilePatch,
  type SchoolSettings,
} from "~/features/settings/api"
import { ariaFor, FormField } from "~/components/forms/form-field"
import { SchoolLogo } from "~/components/common/school-logo"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "~/components/ui/toast"
import { cn } from "~/lib/utils"

import { StepActions, StepLoadFailed } from "./step-parts"
import { useSetupAction } from "../use-setup-action"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EIIN = /^\d{4,10}$/

const TYPE_ICONS: Record<SchoolType, LucideIcon> = {
  school: SchoolIcon,
  college: GraduationCapIcon,
  madrasa: BookOpenIcon,
  coaching: PresentationIcon,
  english_medium: GlobeIcon,
}

/**
 * Step 1: who the school is (kind, which orders the curriculum templates;
 * name, logo, EIIN), where it is and how to reach it, with a preview of
 * how it heads receipts and report cards. Done once it has an address line
 * or district, and a phone or email (`OnboardingService`).
 */
export function ProfileStep({ onContinue }: { onContinue: () => void }) {
  const settings = useQuery(schoolSettingsQuery())
  if (settings.isPending) return <Skeleton className="h-64 rounded-lg" />
  if (settings.isError) return <StepLoadFailed retry={settings.refetch} />
  return <ProfileForm settings={settings.data} onContinue={onContinue} />
}

function ProfileForm({
  settings,
  onContinue,
}: {
  settings: SchoolSettings
  onContinue: () => void
}) {
  const t = useTranslations("onboarding.profile")
  const { organization, profile } = settings
  const [type, setType] = useState<SchoolType>(organization.type)
  const [values, setValues] = useState({
    name: organization.name,
    nameBn: profile.nameBn ?? "",
    eiin: organization.eiin ?? "",
    line1: profile.address.line1 ?? "",
    area: profile.address.area ?? "",
    district: profile.address.district ?? "",
    postCode: profile.address.postCode ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  const save = useSetupAction({
    // Name, kind and EIIN live on the organization (sent only when they
    // changed), the rest in the profile section.
    action: async ({
      org,
      patch,
    }: {
      org: Parameters<typeof updateOrganizationSettings>[0]
      patch: ProfilePatch
    }) => {
      if (Object.keys(org).length) await updateOrganizationSettings(org)
      return updateProfileSettings(patch)
    },
    invalidate: [settingsKeys.all, settingsKeys.display],
    success: () => t("saved"),
    onSuccess: onContinue,
  })

  const set = (name: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }))
  const field = (name: keyof typeof values) => ({
    id: `profile-${name}`,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(name)(e.target.value),
    ...ariaFor(`profile-${name}`, errors[name]),
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const v = Object.fromEntries(
      Object.entries(values).map(([k, x]) => [k, x.trim()])
    ) as typeof values
    const next: Partial<Record<string, string>> = {}
    if (v.name.length < 3) next.name = t("nameRequired")
    if (v.eiin && !EIIN.test(v.eiin)) next.eiin = t("eiinInvalid")
    if (!v.line1 && !v.district) next.line1 = t("addressRequired")
    if (!v.phone && !v.email) next.phone = t("contactRequired")
    if (v.email && !EMAIL.test(v.email)) next.email = t("emailInvalid")
    setErrors(next)
    if (Object.keys(next).length) return

    const org: Parameters<typeof updateOrganizationSettings>[0] = {}
    if (v.name !== organization.name) org.name = v.name
    if (type !== organization.type) org.type = type
    if ((v.eiin || null) !== organization.eiin) org.eiin = v.eiin || null
    save.mutate({
      org,
      patch: {
        nameBn: v.nameBn || null,
        address: {
          line1: v.line1 || null,
          area: v.area || null,
          district: v.district || null,
          postCode: v.postCode || null,
        },
        phone: v.phone || null,
        email: v.email || null,
      },
    })
  }

  /** A letterhead slot jumps to the field that fills it. */
  const focusField = (name: keyof typeof values) =>
    document.getElementById(`profile-${name}`)?.focus()

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <TypeChoice value={type} onChange={setType} />

      <Group title={t("aboutTitle")}>
        <div className="grid gap-4">
          <FormField id="profile-name" label={t("name")} error={errors.name}>
            <Input
              {...field("name")}
              maxLength={100}
              autoComplete="organization"
            />
          </FormField>
          <FormField id="profile-nameBn" label={t("nameBn")}>
            <Input
              {...field("nameBn")}
              lang="bn"
              maxLength={150}
              placeholder={t("nameBnPlaceholder")}
            />
          </FormField>
          <FormField id="profile-eiin" label={t("eiin")} error={errors.eiin}>
            <Input
              {...field("eiin")}
              inputMode="numeric"
              maxLength={10}
              placeholder={t("eiinPlaceholder")}
              className="sm:max-w-40"
            />
          </FormField>
        </div>
      </Group>

      <Group title={t("addressTitle")} hint={t("addressHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              id="profile-line1"
              label={t("line1")}
              error={errors.line1}
            >
              <Input
                {...field("line1")}
                maxLength={200}
                autoComplete="street-address"
                placeholder={t("line1Placeholder")}
              />
            </FormField>
          </div>
          <FormField id="profile-area" label={t("area")}>
            <Input
              {...field("area")}
              maxLength={100}
              autoComplete="address-level3"
              placeholder={t("areaPlaceholder")}
            />
          </FormField>
          <div className="grid grid-cols-[1fr_7rem] gap-4">
            <FormField id="profile-district" label={t("district")}>
              <Input
                {...field("district")}
                maxLength={100}
                autoComplete="address-level2"
                placeholder={t("districtPlaceholder")}
              />
            </FormField>
            <FormField id="profile-postCode" label={t("postCode")}>
              <Input
                {...field("postCode")}
                inputMode="numeric"
                maxLength={12}
                autoComplete="postal-code"
                placeholder={t("postCodePlaceholder")}
              />
            </FormField>
          </div>
        </div>
      </Group>

      <Group title={t("contactTitle")} hint={t("contactHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="profile-phone" label={t("phone")} error={errors.phone}>
            <Input
              {...field("phone")}
              type="tel"
              inputMode="tel"
              maxLength={32}
              autoComplete="tel"
              placeholder={t("phonePlaceholder")}
            />
          </FormField>
          <FormField id="profile-email" label={t("email")} error={errors.email}>
            <Input
              {...field("email")}
              type="email"
              maxLength={254}
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
            />
          </FormField>
        </div>
      </Group>

      <Letterhead
        values={values}
        logoUrl={settings.files?.logoUrl ?? null}
        onFocusField={focusField}
      />

      <div className="lg:ml-44">
        <StepActions pending={save.isPending} submit={t("save")} />
      </div>
    </form>
  )
}

function Group({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    // Wide screens: the heading in a left column (a floated legend can sit
    // beside the fields). The rule is on a wrapper: on the fieldset itself
    // the legend would break it.
    <div className="border-t pt-6 first:border-t-0 first:pt-0">
      <fieldset className="lg:flow-root">
        <legend className="mb-3 flex flex-col gap-0.5 lg:float-left lg:mb-0 lg:w-44 lg:pr-6">
          <span className="text-sm font-semibold">{title}</span>
          {hint && (
            <span className="text-sm text-muted-foreground">{hint}</span>
          )}
        </legend>
        <div className="lg:ml-44">{children}</div>
      </fieldset>
    </div>
  )
}

/** The kind of institution as a row of pills: it orders the curriculum templates. */
function TypeChoice({
  value,
  onChange,
}: {
  value: SchoolType
  onChange: (type: SchoolType) => void
}) {
  const t = useTranslations("onboarding.profile")
  const name = useId()
  return (
    <Group title={t("type")} hint={t("typeHint")}>
      <div className="flex flex-wrap gap-2">
        {SCHOOL_TYPES.map((option) => {
          const Icon = TYPE_ICONS[option]
          const chosen = option === value
          return (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border bg-background py-1.5 pr-3.5 pl-3 text-sm transition-colors hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring/40",
                chosen &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={chosen}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <Icon
                aria-hidden
                className={cn(
                  "size-4",
                  chosen ? "text-primary-foreground" : "text-muted-foreground"
                )}
              />
              {t(`types.${option}`)}
            </label>
          )
        })}
      </div>
    </Group>
  )
}

/**
 * A sample printed heading, filled in live from the form (each document's
 * template may lay these details out its own way), after the fields. Empty parts are slots that
 * jump to their field, and the crest is the logo upload (saved at once).
 */
function Letterhead({
  values,
  logoUrl,
  onFocusField,
}: {
  values: {
    name: string
    nameBn: string
    eiin: string
    line1: string
    area: string
    district: string
    postCode: string
    phone: string
    email: string
  }
  logoUrl: string | null
  onFocusField: (name: "name" | "nameBn" | "line1" | "phone" | "eiin") => void
}) {
  const t = useTranslations("onboarding.profile")
  const v = Object.fromEntries(
    Object.entries(values).map(([k, x]) => [k, x.trim()])
  ) as typeof values
  // "Mirpur, Dhaka 1216": the post code follows the district, as posted.
  const address = [
    v.line1,
    v.area,
    [v.district, v.postCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ")
  const contact = [
    v.phone && { label: t("phone"), value: v.phone },
    v.email && { label: t("email"), value: v.email },
    v.eiin && { label: t("eiin"), value: v.eiin },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="border-t pt-6 lg:flex">
      <div className="mb-3 flex flex-col gap-0.5 lg:mb-0 lg:w-44 lg:shrink-0 lg:pr-6">
        <h3 className="text-sm font-semibold">{t("previewTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("previewHint")}</p>
      </div>
      {/* A sheet of the school's paper: centered, as letterheads are. */}
      <div
        role="region"
        aria-label={t("previewLabel")}
        className="relative min-w-0 flex-1 overflow-hidden rounded-sm border bg-card px-5 pt-6 pb-5 text-center shadow-[0_1px_0_var(--border),0_8px_24px_-12px_oklch(0.3_0.04_165/0.18)] sm:px-10 sm:pt-8"
      >
        <div className="flex flex-col items-center gap-3">
          <LogoSlot name={v.name} logoUrl={logoUrl} />
          <div className="flex max-w-full flex-col items-center gap-1">
            {v.name ? (
              <span className="font-display text-2xl leading-tight text-balance text-foreground sm:text-3xl">
                {v.name}
              </span>
            ) : (
              <Slot onClick={() => onFocusField("name")}>{t("slotName")}</Slot>
            )}
            {v.nameBn ? (
              <span
                lang="bn"
                className="font-bangla text-lg leading-snug font-semibold text-balance"
              >
                {v.nameBn}
              </span>
            ) : (
              <Slot onClick={() => onFocusField("nameBn")}>
                {t("slotNameBn")}
              </Slot>
            )}
          </div>
          <div className="flex max-w-xl flex-col items-center gap-1 text-sm">
            {address ? (
              <span className="text-pretty">{address}</span>
            ) : (
              <Slot onClick={() => onFocusField("line1")}>
                {t("slotAddress")}
              </Slot>
            )}
            {contact.length ? (
              <span className="flex flex-wrap justify-center gap-x-5 gap-y-0.5 text-xs text-muted-foreground">
                {contact.map((c) => (
                  <span key={c.label} className="whitespace-nowrap">
                    {c.label}{" "}
                    <span className="text-foreground tabular-nums">
                      {c.value}
                    </span>
                  </span>
                ))}
              </span>
            ) : (
              <Slot onClick={() => onFocusField("phone")}>
                {t("slotContact")}
              </Slot>
            )}
          </div>
        </div>
        {/* The double rule under a printed heading, in the school's color. */}
        <div aria-hidden className="mt-5 flex flex-col gap-[3px]">
          <span className="h-[2px] bg-primary" />
          <span className="h-px bg-primary/60" />
        </div>
        {/* The document underneath, only suggested. */}
        <div aria-hidden className="mt-4 flex flex-col gap-2 opacity-60">
          <span className="h-1.5 w-1/3 rounded-full bg-muted" />
          <span className="h-1.5 w-full rounded-full bg-muted" />
          <span className="h-1.5 w-5/6 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  )
}

/** An empty part of the letterhead: says what goes there, and goes there. */
function Slot({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm border-b border-dashed border-muted-foreground/50 px-1 text-sm text-muted-foreground transition-colors outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {children}
    </button>
  )
}

/** The crest on the letterhead, which is also the logo upload. */
function LogoSlot({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const t = useTranslations("onboarding.profile")
  const input = useRef<HTMLInputElement>(null)
  const upload = useSetupAction({
    action: uploadLogo,
    invalidate: [settingsKeys.all, settingsKeys.display],
    success: () => t("logoSaved"),
  })

  function onPick(file: File | undefined) {
    if (!file) return
    if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_BYTES) {
      toast.add({ title: t("logoInvalid"), type: "error", timeout: 8000 })
      return
    }
    upload.mutate(file)
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input
        ref={input}
        type="file"
        accept={LOGO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onPick(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <button
        type="button"
        disabled={upload.isPending}
        aria-label={logoUrl ? t("logoChange") : t("logoUpload")}
        title={t("logoHint")}
        onClick={() => input.current?.click()}
        className="group relative rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2"
      >
        {logoUrl ? (
          <SchoolLogo
            name={name || "?"}
            logoUrl={logoUrl}
            alt={t("logoAlt", { name })}
            className="size-16"
          />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-xl border border-dashed border-muted-foreground/50 text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
            <ImageUpIcon aria-hidden className="size-6" />
          </span>
        )}
        {upload.isPending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/80">
            <Spinner />
          </span>
        )}
      </button>
      <span className="text-xs text-muted-foreground">
        {logoUrl ? t("logoChange") : t("logoUpload")}
      </span>
    </div>
  )
}
