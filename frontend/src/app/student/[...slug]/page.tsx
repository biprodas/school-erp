import Link from "next/link"

function formatSegment(segment: string) {
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default async function StudentModulePlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const title = slug.map(formatSegment).join(" · ")

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">
        This area is ready for your student features.{" "}
        <Link
          href="/student/dashboard"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
      </p>
    </div>
  )
}
