import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { initials } from "~/lib/initials"
import { cn } from "~/lib/utils"

/**
 * A person's initials in a circle, as decoration inside a control that is
 * named for them ("Account menu for Rafiq Ahmed"). The letters are CSS
 * generated content, not text, so they are not part of the control's
 * label (WCAG 2.5.3 compares visible text with the accessible name).
 */
export function InitialsAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <Avatar className={cn("size-8", className)} aria-hidden>
      <AvatarFallback
        data-initials={initials(name)}
        className="text-xs font-medium before:content-[attr(data-initials)]"
      />
    </Avatar>
  )
}
