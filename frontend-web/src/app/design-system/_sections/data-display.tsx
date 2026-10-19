"use client"

import {
  BellIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ReceiptTextIcon,
  SearchXIcon,
  UserRoundIcon,
} from "lucide-react"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { AspectRatio } from "~/components/ui/aspect-ratio"
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "~/components/ui/code-block"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "~/components/ui/item"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useHighlightedCode } from "~/hooks/use-highlighted-code"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"

const STUDENTS = [
  { roll: 1, name: "Rafi Ahmed", status: "absent", due: 0 },
  { roll: 2, name: "Nusrat Jahan", status: "present", due: 0 },
  { roll: 3, name: "Tanvir Hossain", status: "late", due: 1200 },
  { roll: 4, name: "Sadia Islam Chowdhury Mim", status: "present", due: 2400 },
  { roll: 5, name: "Arif Rahman", status: "present", due: 0 },
] as const

const STATUS = {
  present: { label: "Present", variant: "success" },
  late: { label: "Late", variant: "warning" },
  absent: { label: "Absent", variant: "destructive" },
} as const

const taka = (amount: number) => `৳${amount.toLocaleString("en-IN")}`

const ATTENDANCE = [
  { week: "Week 1", six: 94, seven: 91, eight: 88 },
  { week: "Week 2", six: 96, seven: 93, eight: 90 },
  { week: "Week 3", six: 92, seven: 89, eight: 86 },
  { week: "Week 4", six: 97, seven: 94, eight: 92 },
]

const chartConfig = {
  six: { label: "Class 6", color: "var(--chart-1)" },
  seven: { label: "Class 7", color: "var(--chart-2)" },
  eight: { label: "Class 8", color: "var(--chart-3)" },
} satisfies ChartConfig

const NOTICES = [
  { title: "Half-yearly exams start 3 November", body: "Routine is on the notice board and in the guardian app." },
  { title: "School closed on 16 December", body: "Victory Day. Classes resume on 17 December." },
  { title: "Fee deadline moved to the 15th", body: "bKash and card payments stay open until midnight." },
  { title: "Sports day registration", body: "Class teachers collect names by Thursday." },
]

const SECTIONS = Array.from({ length: 24 }, (_, index) => {
  const klass = 6 + Math.floor(index / 4)
  const section = "ABCD"[index % 4]
  return { id: `${klass}${section}`, label: `Class ${klass} · Section ${section}`, present: 84 + ((index * 7) % 15) }
})

const SNIPPET = `import { Button } from "~/components/ui/button"

export function SaveRegister() {
  return <Button>Save attendance</Button>
}
`

export function DataDisplay() {
  return (
    <ShowcaseSection
      id="data-display"
      eyebrow="Components"
      title="Data display"
      description="Registers, results and receipts. Numbers are tabular, statuses are badges, and every list has an empty state."
    >
      <BlockGrid>
        <Block name="Card" when="A self-contained summary on paper: a class, a fee head, a plan. Hairline ring, no shadow.">
          <Example title="Typical" frameClassName="block bg-background">
            <Card>
              <CardHeader>
                <CardTitle>Class 7 · Section B</CardTitle>
                <CardDescription>Class teacher: Nasrin Akter</CardDescription>
                <CardAction>
                  <Badge variant="success">Marked</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-end gap-2">
                <span className="type-display-md type-numeral">38/41</span>
                <span className="type-body pb-1 text-muted-foreground">present today</span>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="type-caption text-subtle-foreground">Saved at 9:12 AM</span>
                <Button variant="outline" size="sm">
                  Open register
                </Button>
              </CardFooter>
            </Card>
          </Example>
          <div className="grid gap-4 sm:grid-cols-2">
            <Example title="Small" frameClassName="block bg-background">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Fees collected</CardTitle>
                  <CardDescription>October so far</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="type-title-lg type-numeral">{taka(412300)}</span>
                </CardContent>
              </Card>
            </Example>
            <Example title="Loading" frameClassName="block bg-background">
              <Card size="sm" aria-busy="true">
                <CardHeader>
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-7 w-32" />
                </CardContent>
              </Card>
            </Example>
          </div>
        </Block>

        <Block name="Item" when="Rows in a short list: a guardian, a receipt, a notice. Use Table once there are columns to compare.">
          <Example title="Group" frameClassName="block">
            <ItemGroup>
              <Item variant="outline">
                <ItemMedia variant="icon">
                  <ReceiptTextIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Receipt 004817</ItemTitle>
                  <ItemDescription>Tuition, October · paid by bKash</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="type-numeral">{taka(4020)}</span>
                </ItemActions>
              </Item>
              <ItemSeparator />
              <Item>
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback>FB</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="min-w-0">
                    <span className="truncate">Farzana Begum, mother of Sadia Islam Chowdhury Mim</span>
                  </ItemTitle>
                  <ItemDescription>Primary guardian · 01711-000000</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="ghost" size="icon-sm" aria-label="Open guardian">
                    <ChevronRightIcon />
                  </Button>
                </ItemActions>
              </Item>
              <Item variant="muted" size="sm">
                <ItemMedia variant="icon">
                  <BellIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Absence SMS sent to 3 guardians</ItemTitle>
                </ItemContent>
              </Item>
            </ItemGroup>
          </Example>
        </Block>

        <Block name="Table" when="Compare students across columns. Right-align money, keep roll numbers tabular." wide>
          <Example title="Typical" frameClassName="block">
            <Table>
              <TableCaption>Class 7 · Section B, Tuesday 20 October</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Roll</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Today</TableHead>
                  <TableHead className="text-right">Dues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STUDENTS.map((student) => (
                  <TableRow key={student.roll}>
                    <TableCell className="type-numeral">{String(student.roll).padStart(2, "0")}</TableCell>
                    <TableCell className="max-w-48 truncate font-medium">{student.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS[student.status].variant}>{STATUS[student.status].label}</Badge>
                    </TableCell>
                    <TableCell className="type-numeral text-right">
                      {student.due ? taka(student.due) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total dues</TableCell>
                  <TableCell className="type-numeral text-right">{taka(3600)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Example>
          <Example title="Empty" frameClassName="block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Dues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <SearchXIcon />
                        </EmptyMedia>
                        <EmptyTitle>No students with dues</EmptyTitle>
                        <EmptyDescription>Everyone in Class 7 · B has paid for October.</EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button variant="outline" size="sm">
                          Show all students
                        </Button>
                      </EmptyContent>
                    </Empty>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Example>
        </Block>

        <Block name="Chart" when="Trends over time, such as weekly attendance by class. Colors come from chart-1 to chart-5 only." wide>
          <Example title="Attendance by week, %" frameClassName="block">
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={ATTENDANCE} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="six" fill="var(--color-six)" radius={4} />
                <Bar dataKey="seven" fill="var(--color-seven)" radius={4} />
                <Bar dataKey="eight" fill="var(--color-eight)" radius={4} />
              </BarChart>
            </ChartContainer>
          </Example>
        </Block>

        <Block name="Avatar" when="People: students, staff, guardians. Always has initials as a fallback for missing photos.">
          <Example title="Sizes">
            <Avatar size="sm">
              <AvatarFallback>RA</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>NJ</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>TH</AvatarFallback>
              <AvatarBadge />
            </Avatar>
          </Example>
          <Example title="Missing image falls back">
            <Avatar size="lg">
              <AvatarImage src="/photos/missing-student.jpg" alt="Sadia Islam" />
              <AvatarFallback>SI</AvatarFallback>
            </Avatar>
            <span className="type-body text-muted-foreground">Photo not uploaded yet</span>
          </Example>
          <Example title="Group with count">
            <AvatarGroup>
              {["NA", "KH", "MR", "SB"].map((initials) => (
                <Avatar key={initials}>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              ))}
              <AvatarGroupCount>+18</AvatarGroupCount>
            </AvatarGroup>
            <span className="type-body text-muted-foreground">22 teachers on duty</span>
          </Example>
        </Block>

        <Block name="Accordion" when="Long answers people scan for, like the FAQ or a policy page.">
          <Example title="Typical" frameClassName="block">
            <Accordion defaultValue={["sms"]}>
              <AccordionItem value="sms">
                <AccordionTrigger>Do guardians need a smartphone?</AccordionTrigger>
                <AccordionContent>
                  No. Absence alerts and fee reminders also go out by SMS, in Bangla.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="data">
                <AccordionTrigger>Can we bring last year&apos;s records?</AccordionTrigger>
                <AccordionContent>
                  Yes. Import students and guardians from Excel, and we help with the first upload.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="offline">
                <AccordionTrigger>What happens if the internet drops?</AccordionTrigger>
                <AccordionContent>
                  The register keeps working and saves once the connection is back.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Example>
        </Block>

        <Block name="Collapsible" when="One section that can be hidden, such as a student's older notes.">
          <Example title="Typical" frameClassName="block">
            <CollapsibleNotes />
          </Example>
        </Block>

        <Block name="Carousel" when="A few cards of the same kind to swipe through on a phone, like this week's notices.">
          <Example title="Notices" frameClassName="block px-14">
            <Carousel opts={{ align: "start" }}>
              <CarouselContent>
                {NOTICES.map((notice) => (
                  <CarouselItem key={notice.title} className="sm:basis-1/2">
                    <Card size="sm" className="h-full">
                      <CardHeader>
                        <CardTitle>{notice.title}</CardTitle>
                        <CardDescription>{notice.body}</CardDescription>
                      </CardHeader>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </Example>
        </Block>

        <Block name="Scroll area" when="A long list inside a fixed-height panel, such as all sections in the school.">
          <Example title="Many items" frameClassName="block p-0">
            <ScrollArea className="h-64">
              <ul className="flex flex-col px-5 py-2">
                {SECTIONS.map((section, index) => (
                  <li key={section.id} className="flex flex-col">
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center justify-between py-2.5">
                      <span className="type-body">{section.label}</span>
                      <span className="type-numeral text-sm text-muted-foreground">{section.present}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </Example>
        </Block>

        <Block name="Resizable" when="Desktop split views, such as the student list beside the profile being edited.">
          <Example title="Horizontal" frameClassName="block p-0 overflow-hidden">
            <ResizablePanelGroup orientation="horizontal" className="min-h-48">
              <ResizablePanel defaultSize="40%">
                <div className="flex h-full flex-col gap-1 p-4">
                  <span className="type-label">Students</span>
                  <span className="type-caption text-subtle-foreground">41 in Class 7 · B</span>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="60%">
                <div className="flex h-full flex-col gap-1 p-4">
                  <span className="type-label">Rafi Ahmed</span>
                  <span className="type-caption text-subtle-foreground">Roll 01 · Guardian: Karim Ahmed</span>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </Example>
        </Block>

        <Block name="Aspect ratio" when="Keep media in shape before it loads, like a school photo on a notice.">
          <Example title="16 : 9" frameClassName="block">
            <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-xl bg-muted">
              <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <UserRoundIcon />
                <span className="type-caption">Annual sports day, 2026</span>
              </div>
            </AspectRatio>
          </Example>
        </Block>

        <Block name="Separator" when="Divide groups within one surface. Use it instead of a border div or <hr>.">
          <Example title="Horizontal and vertical" frameClassName="flex-col items-stretch">
            <div className="flex flex-col gap-1">
              <span className="type-label">Dhanmondi Ideal School</span>
              <span className="type-caption text-subtle-foreground">EIIN 108245</span>
            </div>
            <Separator />
            <div className="flex h-5 items-center gap-3 type-body text-muted-foreground">
              <span>1,284 students</span>
              <Separator orientation="vertical" />
              <span>62 staff</span>
              <Separator orientation="vertical" />
              <span>36 sections</span>
            </div>
          </Example>
        </Block>

        <Block name="Code block" when="Code in docs and developer settings, such as an API key example." wide>
          <Example title="Highlighted, with copy" frameClassName="block">
            <SnippetBlock />
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}

function CollapsibleNotes() {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="type-label">Notes on Rafi Ahmed</span>
        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
          {open ? "Hide 2 older" : "Show 2 older"}
          <ChevronDownIcon data-icon="inline-end" className={open ? "rotate-180" : undefined} />
        </CollapsibleTrigger>
      </div>
      <p className="type-body rounded-lg bg-muted px-3 py-2">
        19 Oct: absent, guardian replied &quot;fever&quot;.
      </p>
      <CollapsibleContent className="flex flex-col gap-2">
        <p className="type-body rounded-lg bg-muted px-3 py-2">2 Oct: late twice this week.</p>
        <p className="type-body rounded-lg bg-muted px-3 py-2">14 Sep: moved from Section A.</p>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SnippetBlock() {
  const lines = useHighlightedCode(SNIPPET, "tsx")
  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>save-register.tsx</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={SNIPPET} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent lineNumbers>
        {lines.map((line, index) => (
          <CodeBlockLine key={index} variant={index === 3 ? "highlighted" : "default"}>
            {line}
          </CodeBlockLine>
        ))}
      </CodeBlockContent>
      <CodeBlockFooter>
        <span className="type-caption">Buttons default to the primary variant.</span>
      </CodeBlockFooter>
    </CodeBlock>
  )
}
