/**
 * The bordered panel signup and "Find your school" sit in: the page's
 * heading and what it's for, then its form, on a card set off from the
 * page's muted background. `eyebrow` goes above the heading, e.g. what
 * has been done already.
 */
export function AccountPanel({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string
  description: React.ReactNode
  eyebrow?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
      <div className="flex flex-col gap-2">
        {eyebrow}
        <h1 className="font-display text-3xl font-semibold text-balance">
          {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}
