"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, MailCheckIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "~/apis/tenanted/auth/schema"
import { useRequestPasswordReset } from "~/apis/tenanted/auth/queries"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"

export const ForgotPasswordForm = () => {
  // The backend always responds 200 (anti-enumeration), so on success we show a
  // neutral confirmation regardless of whether the address exists.
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const requestReset = useRequestPasswordReset()

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: ForgotPasswordValues) => {
    try {
      await requestReset.mutateAsync(values.email)
      setSubmittedEmail(values.email)
    } catch {
      toast.error("Something went wrong. Please try again.")
    }
  }

  if (submittedEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheckIcon className="size-5" />
            Check your email
          </CardTitle>
          <CardDescription>
            If an account exists for <strong>{submittedEmail}</strong>, we&apos;ve
            sent a link to reset your password. The link expires in 1 hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Button
              variant="outline"
              onClick={() => {
                setSubmittedEmail(null)
                form.reset()
              }}
            >
              Use a different email
            </Button>
            <FieldDescription className="text-center">
              Remember your password? <Link href="/login">Login</Link>
            </FieldDescription>
          </FieldGroup>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Enter the email tied to your account and we&apos;ll send you a reset
          link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      id={field.name}
                      type="email"
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                    <FieldError
                      id="email-error"
                      errors={[fieldState.error]}
                      className="absolute left-0 -bottom-4.5 text-xs"
                    />
                  </div>
                </Field>
              )}
            />

            <Field>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
              <FieldDescription className="text-center">
                Remember your password? <Link href="/login">Login</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
