import { cn } from "cn"
import { useTranslations } from "next-intl"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const t = useTranslations("ui")
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label={t("loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
