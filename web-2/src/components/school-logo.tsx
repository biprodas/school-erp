import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { cn } from "~/lib/utils"

/** The school's logo, or its initials when it has none. */
export function SchoolLogo({
  name,
  logoUrl,
  alt,
  className,
}: {
  name: string
  logoUrl: string | null
  alt: string
  className?: string
}) {
  return (
    <Avatar className={cn("rounded-xl after:rounded-xl", className)}>
      {logoUrl && (
        <AvatarImage src={logoUrl} alt={alt} className="rounded-xl" />
      )}
      <AvatarFallback className="rounded-xl font-display">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

/** Up to two initials for the logo placeholder: "Dhaka Ideal School" → "DI". */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
