import { BrandMark } from "~/components/brand/brand-mark"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { BRAND } from "~/config/brand-config"

/** A full-screen message (unknown school, backend down, …). */
export function StatusPage({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-4 py-12">
      <Empty className="max-w-md flex-none">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-xl [&_svg]:size-6!"
          >
            {icon}
          </EmptyMedia>
          <EmptyTitle className="font-display text-2xl font-semibold">
            {title}
          </EmptyTitle>
          <EmptyDescription className="text-base">
            {description}
          </EmptyDescription>
        </EmptyHeader>
        {children && <EmptyContent>{children}</EmptyContent>}
      </Empty>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BrandMark className="size-4" />
        {BRAND.name}
      </p>
    </main>
  )
}
