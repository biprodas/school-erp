"use client"

import { CheckCircle2Icon, Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { useVerifyEmail } from "~/apis/tenanted/auth/queries"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"

export default function VerifyEmailView() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const verify = useVerifyEmail()

  // The POST consumes the token, so fire it exactly once on mount. The ref guard
  // prevents React StrictMode's double-invoke from spending the token twice.
  const fired = useRef(false)
  useEffect(() => {
    if (!token || fired.current) return
    fired.current = true
    verify.mutate(token)
  }, [token, verify])

  if (!token) {
    return (
      <ResultCard
        title="Verification link problem"
        description="This verification link is missing its token."
      />
    )
  }

  if (verify.isSuccess) {
    return (
      <ResultCard
        icon={<CheckCircle2Icon className="size-5 text-green-600" />}
        title="Email verified"
        description="Your email address has been confirmed. You can now sign in."
      />
    )
  }

  if (verify.isError) {
    return (
      <ResultCard
        title="Verification link problem"
        description="This verification link is invalid or has expired."
      />
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Verifying your email…</CardTitle>
        <CardDescription>This will only take a moment.</CardDescription>
      </CardHeader>
      <CardContent>
        <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function ResultCard({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/login">Go to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
