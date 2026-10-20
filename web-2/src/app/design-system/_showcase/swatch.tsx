import { cn } from "~/lib/utils"

/**
 * One color role: a chip filled with the token, its paired foreground as sample
 * text, and the token names. Pass full class names so Tailwind can see them.
 */
export function Swatch({
  name,
  bg,
  fg,
  foregroundName,
}: {
  name: string
  /** e.g. "bg-primary" */
  bg: string
  /** e.g. "text-primary-foreground"; omit for tokens without a pair. */
  fg?: string
  foregroundName?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={cn(
          "flex h-16 items-end rounded-lg border p-2 text-sm font-medium",
          bg,
          fg
        )}
      >
        {fg ? "Aa" : null}
      </div>
      <div className="flex min-w-0 flex-col">
        <code className="truncate font-mono text-xs">{name}</code>
        {foregroundName ? (
          <code className="truncate font-mono text-xs text-muted-foreground">
            {foregroundName}
          </code>
        ) : null}
      </div>
    </div>
  )
}
