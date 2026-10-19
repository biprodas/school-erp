import {
  BellIcon,
  CalendarCheckIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  ReceiptTextIcon,
  UsersIcon,
} from "lucide-react"
import { cn } from "~/lib/utils"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"
import { ColorPair } from "../_showcase/color-pair"

const PAIRS = [
  { name: "Page", background: "background", foreground: "foreground" },
  { name: "Card", background: "card", foreground: "card-foreground" },
  { name: "Popover", background: "popover", foreground: "popover-foreground" },
  { name: "Primary action", background: "primary", foreground: "primary-foreground" },
  { name: "Secondary", background: "secondary", foreground: "secondary-foreground" },
  { name: "Muted band", background: "muted", foreground: "muted-foreground" },
  { name: "Accent", background: "accent", foreground: "accent-foreground" },
  { name: "Highlight", background: "highlight", foreground: "highlight-foreground" },
  { name: "Description text", background: "background", foreground: "muted-foreground" },
  { name: "Caption text", background: "background", foreground: "subtle-foreground" },
  { name: "Error text", background: "background", foreground: "destructive" },
  { name: "Absent / overdue", background: "destructive-tint", foreground: "destructive" },
  { name: "Present / paid", background: "success-tint", foreground: "success" },
  { name: "Late / due soon", background: "warning-tint", foreground: "warning" },
]

const PALETTE = [
  {
    group: "Brand",
    swatches: [
      { name: "Forest", token: "forest", value: "#143f30" },
      { name: "Forest 2", token: "forest-2", value: "#1d5a43" },
      { name: "Forest hover", token: "forest-hover", value: "#174a37" },
      { name: "Forest deep", token: "forest-deep", value: "#0e241b" },
      { name: "Marigold", token: "marigold", value: "#f0b24a" },
      { name: "Marigold hover", token: "marigold-hover", value: "#e8a333" },
    ],
  },
  {
    group: "Surfaces",
    swatches: [
      { name: "Canvas", token: "canvas", value: "#f4f5f1" },
      { name: "Paper", token: "paper", value: "#ffffff" },
      { name: "Mint", token: "mint", value: "#e5eee8" },
      { name: "Mint 2", token: "mint-2", value: "#d3e2d8" },
      { name: "Sage", token: "sage", value: "#a9c2b4" },
    ],
  },
  {
    group: "Ink and lines",
    swatches: [
      { name: "Ink", token: "ink", value: "#12271e" },
      { name: "Ink 2", token: "ink-2", value: "#46564e" },
      { name: "Ink 3", token: "ink-3", value: "#6b7a72" },
      { name: "Line", token: "line", value: "#dfe5e0" },
      { name: "Line strong", token: "line-strong", value: "#c9d3cc" },
    ],
  },
  {
    group: "Status",
    swatches: [
      { name: "Red", token: "red", value: "#c2412d" },
      { name: "Red tint", token: "red-tint", value: "#fbe8e4" },
      { name: "Marigold ink", token: "marigold-ink", value: "#7a4d07" },
      { name: "Marigold tint", token: "marigold-tint", value: "#fcefd6" },
    ],
  },
]

const ROLE_SWATCHES = [
  "border",
  "input",
  "ring",
  "band",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-primary",
  "sidebar-accent",
]

const TYPE = [
  { token: "type-display-xl", spec: "57.6–89.6 / 0.98 / 800", use: "Hero headline", sample: "One register for the whole school." },
  { token: "type-display-lg", spec: "41.6–60 / 0.98 / 800", use: "Section heads", sample: "Pay only for the students you have" },
  { token: "type-display-md", spec: "44 / 1 / 800", use: "Prices, key figures", sample: "৳4,020 · 96%" },
  { token: "type-title-lg", spec: "24 / 1.2 / 700", use: "App page titles", sample: "Class 7, section B" },
  { token: "type-title", spec: "20 / 1.3 / 600", use: "Card and plan names", sample: "Standard plan" },
  { token: "type-lead", spec: "18–20 / 1.65 / 400", use: "Intro paragraphs", sample: "Attendance, results, fees and notices on one platform." },
  { token: "type-body", spec: "15 / 1.6 / 400", use: "Running text, lists", sample: "Teachers mark a section in under a minute." },
  { token: "type-eyebrow", spec: "15 / 1.4 / 600", use: "Above section heads", sample: "How it works" },
  { token: "type-label", spec: "14 / 1.4 / 500", use: "Field labels, table heads", sample: "Guardian phone number" },
  { token: "type-caption", spec: "12 / 1.45 / 400", use: "Meta, timestamps", sample: "Sent automatically at 9:15 AM" },
  { token: "type-numeral", spec: "tabular / 600", use: "Money, rolls, counts", sample: "Receipt 004817 · Roll 23" },
]

const RADII = [
  { cls: "rounded-sm", value: "4px", use: "Checkboxes, accents" },
  { cls: "rounded-md", value: "6px", use: "Menu and select items" },
  { cls: "rounded-lg", value: "10px", use: "Inputs, tabs, popovers" },
  { cls: "rounded-xl", value: "12px", use: "Icon tiles, dialogs" },
  { cls: "rounded-2xl", value: "16px", use: "Cards, pricing, toasts" },
  { cls: "rounded-3xl", value: "24px", use: "Product mockups" },
  { cls: "rounded-full", value: "pill", use: "Buttons, badges" },
]

const ELEVATION = [
  { cls: "", ring: true, name: "Hairline", use: "Cards, fields. The default." },
  { cls: "shadow-md", ring: true, name: "shadow-md", use: "Popovers, menus" },
  { cls: "shadow-lg", ring: true, name: "shadow-lg", use: "Dialogs, sheets" },
  { cls: "shadow-xl", ring: false, name: "shadow-xl", use: "Floating notes on the hero" },
  { cls: "shadow-feature", ring: false, name: "shadow-feature", use: "Featured pricing tier only" },
]

const SPACING = [
  { step: "1", px: 4, use: "Icon to label" },
  { step: "2", px: 8, use: "Inside a control" },
  { step: "3", px: 12, use: "Between related items" },
  { step: "5", px: 20, use: "Card content" },
  { step: "6", px: 24, use: "Card padding" },
  { step: "12", px: 48, use: "Between groups" },
  { step: "24", px: 96, use: "Between sections (desktop)" },
]

const MOTION = [
  { token: "animate-rise", value: "600ms · ease-out-soft · 12px up", use: "Hero and section entrances" },
  { token: "animate-fade", value: "200ms · ease-out", use: "Values changing in mockups" },
  { token: "transition-colors", value: "150ms", use: "Hover on buttons and links" },
  { token: "CTA arrow", value: "200ms · translate-x 2px", use: "Get started, Start free trial" },
]

const ICONS = [CalendarCheckIcon, ReceiptTextIcon, BellIcon, UsersIcon, GraduationCapIcon, ClipboardListIcon]

export function Foundations() {
  return (
    <ShowcaseSection
      id="foundations"
      eyebrow="Foundations"
      title="Color, type and shape"
      description="Roles first, then the raw palette. Components only ever use roles, so the dark theme and the forest bands come for free."
    >
      <Block name="Color roles" when="Each surface with its foreground and the contrast measured live. Toggle the theme to re-measure.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {PAIRS.map((pair) => (
            <ColorPair key={pair.name} {...pair} />
          ))}
        </div>
      </Block>

      <Block name="Palette" when="The raw Kampasy colors, grouped as in DESIGN.md. Use as bg-<token> only for illustrations and mockups.">
        <div className="flex flex-col gap-6">
          {PALETTE.map((group) => (
            <div key={group.group} className="flex flex-col gap-2">
              <p className="type-label">{group.group}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {group.swatches.map((swatch) => (
                  <div key={swatch.token} className="flex flex-col gap-2">
                    <div
                      className="h-16 rounded-xl ring-1 ring-border ring-inset"
                      style={{ backgroundColor: `var(--color-${swatch.token})` }}
                    />
                    <div className="flex flex-col">
                      <span className="type-label">{swatch.name}</span>
                      <span className="type-caption font-mono text-subtle-foreground">
                        {swatch.token} · {swatch.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <p className="type-label">Role tokens without a pair</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {ROLE_SWATCHES.map((token) => (
                <div key={token} className="flex flex-col gap-2">
                  <div
                    className="h-12 rounded-xl ring-1 ring-border ring-inset"
                    style={{ backgroundColor: `var(--${token})` }}
                  />
                  <span className="type-caption font-mono text-subtle-foreground">--{token}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Block>

      <Block name="Typography" when="Anek Bangla for everything. Display sizes run at width 75, weight 800.">
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border">
          <table className="w-full min-w-[44rem] text-left">
            <thead>
              <tr className="border-b">
                <th scope="col" className="type-label px-5 py-3 text-muted-foreground">Token</th>
                <th scope="col" className="type-label px-5 py-3 text-muted-foreground">Spec</th>
                <th scope="col" className="type-label px-5 py-3 text-muted-foreground">Use</th>
                <th scope="col" className="type-label px-5 py-3 text-muted-foreground">Specimen</th>
              </tr>
            </thead>
            <tbody>
              {TYPE.map((row) => (
                <tr key={row.token} className="border-b last:border-0">
                  <td className="px-5 py-4 align-middle font-mono text-xs whitespace-nowrap">{row.token}</td>
                  <td className="type-caption px-5 py-4 align-middle whitespace-nowrap text-muted-foreground">{row.spec}</td>
                  <td className="type-caption px-5 py-4 align-middle whitespace-nowrap text-muted-foreground">{row.use}</td>
                  <td className="max-w-md px-5 py-4 align-middle">
                    <p className={cn(row.token, "truncate")}>{row.sample}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="type-body">
            When Rafi is marked absent at 9:10, his guardian gets an SMS in Bangla five minutes
            later: <span lang="bn">আজ রাফি স্কুলে অনুপস্থিত।</span> The office sees it on the{" "}
            <a href="#recipes" className="font-medium text-primary underline underline-offset-4">
              attendance screen
            </a>
            , and the sync job logs it as <code className="rounded-sm bg-muted px-1 font-mono text-[13px]">attendance.absent</code>.
          </p>
          <p lang="bn" className="type-body text-muted-foreground">
            একই টাইপফেসে বাংলা ও ইংরেজি, তাই অভিভাবকের বার্তা আর প্রধান শিক্ষকের প্রতিবেদন একই রকম দেখায়।
          </p>
        </div>
      </Block>

      <BlockGrid>
        <Block name="Radius" when="Pinned per step. Nothing outside the scale.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RADII.map((radius) => (
              <div key={radius.cls} className="flex flex-col gap-2">
                <div className={cn("h-16 bg-secondary ring-1 ring-border", radius.cls)} />
                <span className="type-caption font-mono">{radius.cls} · {radius.value}</span>
                <span className="type-caption text-subtle-foreground">{radius.use}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block name="Elevation" when="Hairlines first. Shadows only for what floats.">
          <div className="grid grid-cols-2 gap-5 rounded-2xl bg-muted p-5 sm:grid-cols-3">
            {ELEVATION.map((level) => (
              <div
                key={level.name}
                className={cn(
                  "flex h-24 flex-col justify-end gap-0.5 rounded-2xl bg-card p-3",
                  level.ring && "ring-1 ring-border",
                  level.cls
                )}
              >
                <span className="type-caption font-mono">{level.name}</span>
                <span className="type-caption text-subtle-foreground">{level.use}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block name="Spacing" when="Tailwind's 4px scale. The ladder below is how far apart things sit.">
          <div className="flex flex-col gap-2">
            {SPACING.map((space) => (
              <div key={space.step} className="grid grid-cols-[4rem_1fr] items-center gap-3">
                <span className="type-caption font-mono">{space.step} · {space.px}px</span>
                <div className="flex items-center gap-3">
                  <div className="h-3 rounded-sm bg-primary" style={{ width: space.px }} />
                  <span className="type-caption text-subtle-foreground">{space.use}</span>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block name="Motion" when="Short and soft. Everything stops under prefers-reduced-motion.">
          <div className="flex flex-col divide-y rounded-2xl bg-card ring-1 ring-border">
            {MOTION.map((motion) => (
              <div key={motion.token} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="font-mono text-xs sm:w-36">{motion.token}</span>
                <span className="type-caption text-muted-foreground sm:w-56">{motion.value}</span>
                <span className="type-caption text-subtle-foreground">{motion.use}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block name="Icons" when="lucide-react at the sizes components use: 12, 14, 16 and 18px." wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Example title="foreground">
              {[12, 14, 16, 18].map((size) => (
                <div key={size} className="flex items-center gap-2">
                  {ICONS.map((Icon, index) => (
                    <Icon key={index} aria-hidden="true" style={{ width: size, height: size }} />
                  ))}
                  <span className="type-caption font-mono text-subtle-foreground">{size}</span>
                </div>
              ))}
            </Example>
            <Example title="muted-foreground" frameClassName="text-muted-foreground">
              {[12, 14, 16, 18].map((size) => (
                <div key={size} className="flex items-center gap-2">
                  {ICONS.map((Icon, index) => (
                    <Icon key={index} aria-hidden="true" style={{ width: size, height: size }} />
                  ))}
                  <span className="type-caption font-mono">{size}</span>
                </div>
              ))}
            </Example>
          </div>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
