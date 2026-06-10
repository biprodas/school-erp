"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  useCheckResetToken,
  useResetPassword,
} from "~/apis/platform/auth/queries"
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "~/apis/platform/auth/schema"
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
import { cn } from "~/lib/utils"

export const PlatformResetPasswordForm = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const router = useRouter()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const check = useCheckResetToken(token)
  const reset = useResetPassword()

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  if (!token) {
    return <InvalidState description="This reset link is missing its token." />
  }

  if (check.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Checking your reset link…</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
          </FieldGroup>
        </CardContent>
      </Card>
    )
  }

  if (check.isError || !check.data) {
    return (
      <InvalidState description="This reset link is invalid or has expired. Request a new one to continue." />
    )
  }

  const onSubmit = async (values: ResetPasswordValues) => {
    try {
      await reset.mutateAsync({ token, password: values.password })
    } catch {
      toast.error("Could not reset password. The link may have expired.")
      return
    }
    toast.success("Password has been reset")
    router.push("/login")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Choose a new password for <strong>{check.data.email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      id={field.name}
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.error ? "password-error" : undefined}
                      className={cn("pr-10")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
                    </button>
                    <FieldError
                      id="password-error"
                      errors={[fieldState.error]}
                      className="absolute left-0 -bottom-4.5 text-xs"
                    />
                  </div>
                </Field>
              )}
            />

            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      id={field.name}
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.error ? "confirmPassword-error" : undefined}
                      className={cn("pr-10")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      aria-pressed={showConfirm}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
                    </button>
                    <FieldError
                      id="confirmPassword-error"
                      errors={[fieldState.error]}
                      className="absolute left-0 -bottom-4.5 text-xs"
                    />
                  </div>
                </Field>
              )}
            />

            <Field>
              <Button
                type="submit"
                disabled={reset.isPending || form.formState.isSubmitting}
              >
                {reset.isPending || form.formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Resetting…
                  </>
                ) : (
                  "Reset password"
                )}
              </Button>
              <FieldDescription className="text-center">
                Back to <Link href="/login">Login</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function InvalidState({ description }: { description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset link problem</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Button asChild>
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
          <FieldDescription className="text-center">
            Back to <Link href="/login">Login</Link>
          </FieldDescription>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
