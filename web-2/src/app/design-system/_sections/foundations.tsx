import { ArrowRightIcon, SaveIcon } from "lucide-react"

import { Button } from "~/components/ui/button"
import { ButtonGroup } from "~/components/ui/button-group"
import { DirectionProvider } from "~/components/ui/direction"
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { cn } from "~/lib/utils"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/section"
import { Swatch } from "../_showcase/swatch"

type SwatchSpec = {
  name: string
  bg: string
  fg?: string
  foregroundName?: string
}

const COLOR_GROUPS: { title: string; swatches: SwatchSpec[] }[] = [
  {
    title: "Surfaces",
    swatches: [
      { name: "background", bg: "bg-background", fg: "text-foreground", foregroundName: "foreground" },
      { name: "card", bg: "bg-card", fg: "text-card-foreground", foregroundName: "card-foreground" },
      { name: "popover", bg: "bg-popover", fg: "text-popover-foreground", foregroundName: "popover-foreground" },
      { name: "muted", bg: "bg-muted", fg: "text-muted-foreground", foregroundName: "muted-foreground" },
    ],
  },
  {
    title: "Brand and actions",
    swatches: [
      { name: "primary", bg: "bg-primary", fg: "text-primary-foreground", foregroundName: "primary-foreground" },
      { name: "secondary", bg: "bg-secondary", fg: "text-secondary-foreground", foregroundName: "secondary-foreground" },
      { name: "accent", bg: "bg-accent", fg: "text-accent-foreground", foregroundName: "accent-foreground" },
    ],
  },
  {
    title: "States",
    swatches: [{ name: "destructive", bg: "bg-destructive" }],
  },
  {
    title: "Borders and focus",
    swatches: [
      { name: "border", bg: "bg-border" },
      { name: "input", bg: "bg-input" },
      { name: "ring", bg: "bg-ring" },
    ],
  },
  {
    title: "Charts",
    swatches: [
      { name: "chart-1", bg: "bg-chart-1" },
      { name: "chart-2", bg: "bg-chart-2" },
      { name: "chart-3", bg: "bg-chart-3" },
      { name: "chart-4", bg: "bg-chart-4" },
      { name: "chart-5", bg: "bg-chart-5" },
    ],
  },
  {
    title: "Sidebar",
    swatches: [
      { name: "sidebar", bg: "bg-sidebar", fg: "text-sidebar-foreground", foregroundName: "sidebar-foreground" },
      { name: "sidebar-primary", bg: "bg-sidebar-primary", fg: "text-sidebar-primary-foreground", foregroundName: "sidebar-primary-foreground" },
      { name: "sidebar-accent", bg: "bg-sidebar-accent", fg: "text-sidebar-accent-foreground", foregroundName: "sidebar-accent-foreground" },
      { name: "sidebar-border", bg: "bg-sidebar-border" },
      { name: "sidebar-ring", bg: "bg-sidebar-ring" },
    ],
  },
]

const RADII = [
  { name: "rounded-sm", className: "rounded-sm" },
  { name: "rounded-md", className: "rounded-md" },
  { name: "rounded-lg", className: "rounded-lg" },
  { name: "rounded-xl", className: "rounded-xl" },
  { name: "rounded-2xl", className: "rounded-2xl" },
  { name: "rounded-3xl", className: "rounded-3xl" },
  { name: "rounded-4xl", className: "rounded-4xl" },
  { name: "rounded-full", className: "rounded-full" },
]

const TYPE_SCALE = [
  { name: "text-xs", className: "text-xs", sample: "Roll 14 · Class 7 · Section B" },
  { name: "text-sm", className: "text-sm", sample: "Ayesha Rahman was marked present at 8:02 AM" },
  { name: "text-base", className: "text-base", sample: "Monthly tuition fee due: ৳1,200" },
  { name: "text-lg", className: "text-lg", sample: "Attendance register" },
  { name: "text-xl", className: "text-xl", sample: "Class 7 · Section B" },
  { name: "text-2xl", className: "text-2xl", sample: "Fee collection" },
  { name: "text-3xl", className: "text-3xl", sample: "Half-yearly results" },
  { name: "text-4xl", className: "text-4xl", sample: "96.4%" },
  { name: "text-5xl", className: "text-5xl", sample: "৳4,82,000" },
]

const SHADOWS = [
  { name: "shadow-xs", className: "shadow-xs" },
  { name: "shadow-sm", className: "shadow-sm" },
  { name: "shadow-md", className: "shadow-md" },
  { name: "shadow-lg", className: "shadow-lg" },
]

export function Foundations() {
  return (
    <ShowcaseSection
      id="foundations"
      title="Foundations"
      description="The stock tokens every component is built from: color roles, radius, type, elevation and text direction. Components use these roles, never raw colors, so light and dark stay in step."
    >
      <BlockGrid>
        <Block
          wide
          name="Colors"
          when="Pick a role, not a shade. Surfaces carry content, primary marks the main action, destructive flags absences, dues and deletes."
        >
          {COLOR_GROUPS.map((group) => (
            <Example key={group.title} title={group.title} frameClassName="block">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {group.swatches.map((swatch) => (
                  <Swatch key={swatch.name} {...swatch} />
                ))}
              </div>
            </Example>
          ))}
        </Block>

        <Block
          name="Radius"
          when="Derived from one --radius value. Buttons and inputs use lg, cards xl, pills and avatars full."
        >
          <Example title="rounded-sm … rounded-full" frameClassName="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {RADII.map((radius) => (
              <div key={radius.name} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "size-16 border border-border bg-muted",
                    radius.className
                  )}
                />
                <code className="font-mono text-xs text-muted-foreground">
                  {radius.name}
                </code>
              </div>
            ))}
          </Example>
        </Block>

        <Block
          name="Shadows"
          when="Keep elevation low. Raised cards and menus use sm or md; reserve lg for floating panels."
        >
          <Example title="shadow-xs … shadow-lg" frameClassName="grid grid-cols-2 gap-5 bg-muted sm:grid-cols-4">
            {SHADOWS.map((shadow) => (
              <div
                key={shadow.name}
                className={cn(
                  "flex h-20 flex-col justify-end rounded-xl bg-card p-3 text-card-foreground",
                  shadow.className
                )}
              >
                <code className="font-mono text-xs">{shadow.name}</code>
              </div>
            ))}
          </Example>
        </Block>

        <Block
          wide
          name="Typography"
          when="Headings use font-heading, body copy font-sans, IDs and amounts in tables font-mono. Bangla falls back to the system font."
        >
          <Example title="Families" frameClassName="grid gap-4 sm:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1">
              <code className="font-mono text-xs text-muted-foreground">font-heading</code>
              <p className="font-heading text-2xl font-semibold tracking-tight">
                Admission open for 2027
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <code className="font-mono text-xs text-muted-foreground">font-sans</code>
              <p className="font-sans text-base">
                Guardians receive an SMS when a student is marked absent.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <code className="font-mono text-xs text-muted-foreground">font-mono</code>
              <p className="font-mono text-base">STU-2026-00142 · ৳1,200.00</p>
            </div>
          </Example>

          <Example title="Size scale" frameClassName="block overflow-x-auto">
            <div className="flex min-w-max flex-col gap-3">
              {TYPE_SCALE.map((step) => (
                <div key={step.name} className="flex items-baseline gap-4">
                  <code className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                    {step.name}
                  </code>
                  <span className={cn("font-medium", step.className)}>
                    {step.sample}
                  </span>
                </div>
              ))}
            </div>
          </Example>

          <Example title="Weights and Bangla fallback" frameClassName="flex-col items-start gap-2">
            <p className="text-base font-normal">font-normal · Ayesha Rahman, Roll 14</p>
            <p className="text-base font-medium">font-medium · Ayesha Rahman, Roll 14</p>
            <p className="text-base font-semibold">font-semibold · Ayesha Rahman, Roll 14</p>
            <p lang="bn" className="text-2xl font-semibold">
              উপস্থিতি · ৳১,২০০
            </p>
            <p lang="bn" className="text-sm text-muted-foreground">
              আয়েশা রহমান · সপ্তম শ্রেণি, শাখা খ
            </p>
          </Example>
        </Block>

        <Block
          wide
          name="Direction"
          when="DirectionProvider tells Base UI components which way to lay out and navigate by keyboard. Pair it with dir on a wrapper so CSS logical properties flip too."
        >
          <Example title='DirectionProvider direction="rtl" + dir="rtl"' frameClassName="block">
            <DirectionProvider direction="rtl">
              <div dir="rtl" className="flex max-w-md flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="ds-rtl-guardian">Guardian name</FieldLabel>
                  <Input id="ds-rtl-guardian" defaultValue="Karim Rahman" />
                  <FieldDescription>
                    Labels, text and icons start from the right edge.
                  </FieldDescription>
                </Field>
                <ButtonGroup>
                  <Button variant="outline">
                    <ArrowRightIcon data-icon="inline-start" />
                    Back
                  </Button>
                  <Button variant="outline">Save draft</Button>
                  <Button variant="outline">
                    <SaveIcon data-icon="inline-start" />
                    Submit
                  </Button>
                </ButtonGroup>
              </div>
            </DirectionProvider>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
