"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ROUTES } from "~/constants";
import { useRegister } from "~/features/auth/hooks"
import { resolveClientTenantSlug } from "~/lib/tenant"
import { ApiError } from "~/types/api"
import { cn } from "~/lib/utils"
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
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

const signupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
})

type SignupFormValues = z.infer<typeof signupSchema>

export const SignupForm = () => {
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const registerMutation = useRegister("tenant")

  const loginHref = ROUTES.TENANT_LOGIN
  const redirectTo = ROUTES.DEFAULT_LOGIN_REDIRECT

  // Resolve tenant from the host (subdomain parse, or custom-domain lookup).
  const [detectedSlug, setDetectedSlug] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    resolveClientTenantSlug().then((slug) => {
      if (!active) return
      setDetectedSlug(slug)
    })
    return () => {
      active = false
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  const onSubmit = async (values: SignupFormValues) => {
    const effectiveSlug = detectedSlug || ""
    if (!effectiveSlug) {
      toast.error("Could not determine your workspace")
      return
    }

    try {
      const result = await registerMutation.mutateAsync({
        payload: {
          name: values.name,
          email: values.email,
          password: values.password,
        },
        tenantSlug: effectiveSlug || undefined,
      })
      if (!result || result.error) {
        toast.success("Account created — please sign in")
        router.push(loginHref)
        return
      }
      toast.success("Account created")
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not create account",
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Enter your details below to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Doe"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  {...register("name")}
                />
                <FieldError
                  id="name-error"
                  errors={errors.name ? [errors.name] : []}
                  className="absolute left-0 -bottom-4.5 text-xs"
                />
              </div>
            </Field>
            <Field className="gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
                <FieldError
                  id="email-error"
                  errors={errors.email ? [errors.email] : []}
                  className="absolute left-0 -bottom-4.5 text-xs"
                />
              </div>
            </Field>
            <Field className="gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  className={cn("pr-10")}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
                <FieldError
                  id="password-error"
                  errors={errors.password ? [errors.password] : []}
                  className="absolute left-0 -bottom-4.5 text-xs"
                />
              </div>
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
              <FieldDescription className="text-center">
                Already have an account? <Link href={loginHref}>Login</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
