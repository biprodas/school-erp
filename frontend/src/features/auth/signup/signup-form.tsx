"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  DEFAULT_LOGIN_REDIRECT,
  PLATFORM_LOGIN,
  PLATFORM_LOGIN_REDIRECT,
  TENANT_LOGIN,
} from "~/constants/routes"
import { useRegister } from "~/features/auth/hooks"
import { getClientTenantSlug } from "~/lib/tenant"
import { ApiError } from "~/types/api"
import type { AuthKind } from "~/types/user"
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
  tenantSlug: z.string().optional(),
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

interface SignupFormProps {
  authKind?: AuthKind
}

export const SignupForm = ({ authKind = "tenant" }: SignupFormProps) => {
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const registerMutation = useRegister(authKind)

  const loginHref = authKind === "platform" ? PLATFORM_LOGIN : TENANT_LOGIN
  const redirectTo =
    authKind === "platform" ? PLATFORM_LOGIN_REDIRECT : DEFAULT_LOGIN_REDIRECT

  // Resolve tenant from the subdomain after mount (avoids SSR/host mismatch).
  const [detectedSlug, setDetectedSlug] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setDetectedSlug(getClientTenantSlug())
    setMounted(true)
  }, [])
  const needsSlug = mounted && authKind === "tenant" && !detectedSlug

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      tenantSlug: "",
      name: "",
      email: "",
      password: "",
    },
  })

  const onSubmit = async (values: SignupFormValues) => {
    const effectiveSlug = detectedSlug || values.tenantSlug?.trim() || ""
    if (authKind === "tenant" && !effectiveSlug) {
      setError("tenantSlug", { message: "Enter your workspace" })
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
            {needsSlug && (
              <Field className="gap-2">
                <Label htmlFor="tenantSlug">Workspace</Label>
                <div className="relative">
                  <Input
                    id="tenantSlug"
                    type="text"
                    placeholder="your-school"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={!!errors.tenantSlug}
                    {...register("tenantSlug")}
                  />
                  <FieldError
                    id="tenantSlug-error"
                    errors={errors.tenantSlug ? [errors.tenantSlug] : []}
                    className="absolute left-0 -bottom-4.5 text-xs"
                  />
                </div>
              </Field>
            )}
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
