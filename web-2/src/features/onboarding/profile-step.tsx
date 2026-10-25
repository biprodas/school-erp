"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import {
  schoolSettingsQuery,
  settingsKeys,
  updateProfileSettings,
  type SchoolSettings,
} from "~/api/settings"
import { ariaFor, FormField } from "~/components/form/form-field"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"

import { StepActions, StepLoadFailed } from "./step-parts"
import { useSetupAction } from "./use-setup-action"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Step 1: where the school is and how to reach it. Done once it has an
 * address line or district, and a phone or email (`OnboardingService`).
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
  const { address, phone, email } = settings.profile
  const [values, setValues] = useState({
    line1: address.line1 ?? "",
    district: address.district ?? "",
    phone: phone ?? "",
    email: email ?? "",
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  const save = useSetupAction({
    action: updateProfileSettings,
    invalidate: [settingsKeys.all],
    success: () => t("saved"),
    onSuccess: onContinue,
  })

  const set = (name: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }))

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const v = {
      line1: values.line1.trim(),
      district: values.district.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
    }
    const next: Partial<Record<string, string>> = {}
    if (!v.line1 && !v.district) next.line1 = t("addressRequired")
    if (!v.phone && !v.email) next.phone = t("contactRequired")
    if (v.email && !EMAIL.test(v.email)) next.email = t("emailInvalid")
    setErrors(next)
    if (Object.keys(next).length) return
    save.mutate({
      address: { line1: v.line1 || null, district: v.district || null },
      phone: v.phone || null,
      email: v.email || null,
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="profile-line1" label={t("line1")} error={errors.line1}>
          <Input
            id="profile-line1"
            value={values.line1}
            onChange={(e) => set("line1")(e.target.value)}
            maxLength={200}
            autoComplete="street-address"
            {...ariaFor("profile-line1", errors.line1)}
          />
        </FormField>
        <FormField id="profile-district" label={t("district")}>
          <Input
            id="profile-district"
            value={values.district}
            onChange={(e) => set("district")(e.target.value)}
            maxLength={100}
            autoComplete="address-level2"
          />
        </FormField>
        <FormField id="profile-phone" label={t("phone")} error={errors.phone}>
          <Input
            id="profile-phone"
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => set("phone")(e.target.value)}
            maxLength={32}
            autoComplete="tel"
            {...ariaFor("profile-phone", errors.phone)}
          />
        </FormField>
        <FormField id="profile-email" label={t("email")} error={errors.email}>
          <Input
            id="profile-email"
            type="email"
            value={values.email}
            onChange={(e) => set("email")(e.target.value)}
            maxLength={254}
            autoComplete="email"
            {...ariaFor("profile-email", errors.email)}
          />
        </FormField>
      </div>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <StepActions pending={save.isPending} submit={t("save")} />
    </form>
  )
}
