import { Suspense } from "react"
import { FaSchool } from "react-icons/fa6"
import { PlatformLoginForm } from "./platform-login-form"

export default function PlatformLoginView() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FaSchool className="size-4" />
          </div>
          SchoolERP Platform
        </a>
        <Suspense fallback={null}>
          <PlatformLoginForm />
        </Suspense>
      </div>
    </div>
  )
}
