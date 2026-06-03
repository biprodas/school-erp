import { Suspense } from "react"
import Link from "next/link"
import { LoginForm } from "./login-form"
import { FaSchool } from "react-icons/fa6"

export default function TenantLoginView() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FaSchool className="size-4" />
          </div>
          Acme School
        </Link>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
