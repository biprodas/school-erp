"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  BookOpenIcon,
  CalendarCheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PhoneIcon,
} from "lucide-react"

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
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Separator } from "~/components/ui/separator"
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
import { cn } from "~/lib/utils"
import {
  Block,
  BlockGrid,
  Example,
  ShowcaseSection,
} from "../_showcase/section"

const taka = (amount: number) => `৳${amount.toLocaleString("en-IN")}`

type FeeStatus = "Paid" | "Partial" | "Due" | "Waived"

const FEE_ROWS: {
  roll: string
  name: string
  attendance: number
  amount: number
  status: FeeStatus
}[] = [
  {
    roll: "01",
    name: "Ayesha Rahman",
    attendance: 97,
    amount: 3500,
    status: "Paid",
  },
  {
    roll: "02",
    name: "Tanvir Hossain",
    attendance: 91,
    amount: 3500,
    status: "Paid",
  },
  {
    roll: "03",
    name: "Nusrat Jahan",
    attendance: 84,
    amount: 1750,
    status: "Partial",
  },
  { roll: "04", name: "Rafi Ahmed", attendance: 72, amount: 0, status: "Due" },
  {
    roll: "05",
    name: "Sadia Islam",
    attendance: 95,
    amount: 0,
    status: "Waived",
  },
]

const STATUS_VARIANT = {
  Paid: "secondary",
  Partial: "outline",
  Due: "destructive",
  Waived: "ghost",
} as const satisfies Record<FeeStatus, string>

// An inline placeholder photo, so the image state renders without a network request.
const SAMPLE_PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#a3a3a3"/><circle cx="32" cy="25" r="11" fill="#e5e5e5"/><path d="M12 60c2-12 10-18 20-18s18 6 20 18z" fill="#e5e5e5"/></svg>'
  )

const STUDENTS = [
  "Ayesha Rahman",
  "Tanvir Hossain",
  "Nusrat Jahan",
  "Rafi Ahmed",
  "Sadia Islam",
  "Mahin Chowdhury",
  "Farhana Akter",
  "Imran Kabir",
  "Lamia Sultana",
  "Arif Hasan",
  "Mithila Das",
  "Sakib Mahmud",
  "Tasnim Ferdous",
  "Nafis Iqbal",
  "Rumana Begum",
  "Zarif Anwar",
  "Priya Saha",
  "Shuvo Paul",
  "Maliha Noor",
  "Rakib Hasan",
]

const NOTICES = [
  {
    title: "Half-yearly exams",
    body: "Start Sunday, 3 November. Seat plans are on the notice board.",
    tag: "Exams",
  },
  {
    title: "Fee deadline",
    body: "November tuition is due by the 10th. A ৳100 late fee applies after.",
    tag: "Fees",
  },
  {
    title: "Guardian meeting",
    body: "Class 7 guardians, Thursday 4:00 PM in the main hall.",
    tag: "Events",
  },
  {
    title: "Science fair",
    body: "Project proposals are due to class teachers by 15 November.",
    tag: "Academics",
  },
]

const FEE_COLLECTION = [
  { month: "Jan", collected: 412000, due: 58000 },
  { month: "Feb", collected: 386000, due: 74000 },
  { month: "Mar", collected: 441000, due: 39000 },
  { month: "Apr", collected: 398000, due: 62000 },
  { month: "May", collected: 455000, due: 31000 },
  { month: "Jun", collected: 372000, due: 88000 },
]

const chartConfig = {
  collected: { label: "Collected", color: "var(--chart-1)" },
  due: { label: "Outstanding", color: "var(--chart-2)" },
} satisfies ChartConfig

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
}

export function DataDisplay() {
  const totalCollected = FEE_ROWS.reduce((sum, row) => sum + row.amount, 0)

  return (
    <ShowcaseSection
      id="data-display"
      title="Data display"
      description="Cards, tables, lists and charts for showing school records: students, fees, attendance and notices."
    >
      <BlockGrid>
        <Block
          name="Card"
          when="Group one record or one summary, like a student's profile at a glance."
        >
          <Example title="student summary" frameClassName="block">
            <Card>
              <CardHeader>
                <CardTitle>Ayesha Rahman</CardTitle>
                <CardDescription>Class 7 · Section B · Roll 01</CardDescription>
                <CardAction>
                  <Badge variant="secondary">Active</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">
                      Attendance
                    </dt>
                    <dd className="font-medium tabular-nums">97%</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">GPA</dt>
                    <dd className="font-medium tabular-nums">4.83</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Fees due</dt>
                    <dd className="font-medium tabular-nums">{taka(0)}</dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="outline" size="sm">
                  Message guardian
                </Button>
                <Button size="sm">View profile</Button>
              </CardFooter>
            </Card>
          </Example>
          <Example title='size="sm"' frameClassName="block">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Today&apos;s attendance</CardTitle>
                <CardDescription>41 of 44 present</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">93%</p>
              </CardContent>
            </Card>
          </Example>
        </Block>

        <Block
          name="Badge"
          when="A short status or count next to a label. Pick the variant by how much attention it needs."
        >
          <Example title="variants">
            <Badge>Default</Badge>
            <Badge variant="secondary">Paid</Badge>
            <Badge variant="destructive">Due</Badge>
            <Badge variant="outline">Partial</Badge>
            <Badge variant="ghost">Waived</Badge>
            <Badge variant="link">Class 7 · B</Badge>
          </Example>
          <Example title="with icon">
            <Badge variant="secondary">
              <CalendarCheckIcon data-icon="inline-start" />
              Present
            </Badge>
            <Badge variant="outline">
              <BookOpenIcon data-icon="inline-start" />6 subjects
            </Badge>
          </Example>
        </Block>

        <Block
          name="Table"
          when="Rows of the same kind of record to compare and total, like a section's fee status."
          wide
        >
          <Example
            title="fee status · Class 7 · Section B"
            frameClassName="block p-0 sm:p-2"
          >
            <Table>
              <TableCaption>
                October tuition, updated today at 2:15 PM.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Roll</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FEE_ROWS.map((row) => (
                  <TableRow key={row.roll}>
                    <TableCell className="font-mono text-muted-foreground">
                      {row.roll}
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.attendance}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {taka(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total collected</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {taka(totalCollected)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Example>
        </Block>

        <Block
          name="Avatar"
          when="A person's photo, falling back to initials when there is none."
        >
          <Example title="image, fallback, sizes">
            <Avatar size="sm">
              <AvatarFallback>AR</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarImage src={SAMPLE_PHOTO} alt="Tanvir Hossain" />
              <AvatarFallback>TH</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>NJ</AvatarFallback>
              <AvatarBadge />
            </Avatar>
          </Example>
          <Example title="group">
            <AvatarGroup>
              {STUDENTS.slice(0, 4).map((name) => (
                <Avatar key={name}>
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
              ))}
              <AvatarGroupCount>+37</AvatarGroupCount>
            </AvatarGroup>
            <span className="text-sm text-muted-foreground">
              41 students in Section B
            </span>
          </Example>
        </Block>

        <Block
          name="Item"
          when="A row in a list with media, text and actions, like documents or guardians."
        >
          <Example frameClassName="block">
            <ItemGroup>
              <Item variant="outline">
                <ItemMedia variant="icon">
                  <FileTextIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Birth certificate</ItemTitle>
                  <ItemDescription>
                    Uploaded 12 Jan · PDF · 420 KB
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </ItemActions>
              </Item>
              <Item variant="muted">
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback>KR</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Karim Rahman</ItemTitle>
                  <ItemDescription>Father · primary guardian</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Call Karim Rahman"
                  >
                    <PhoneIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More actions"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </ItemActions>
              </Item>
              <ItemSeparator />
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>Transport</ItemTitle>
                  <ItemDescription>Route 3 · Mirpur 10 pickup</ItemDescription>
                </ItemContent>
                <Badge variant="outline">Active</Badge>
              </Item>
            </ItemGroup>
          </Example>
        </Block>

        <Block
          name="Accordion"
          when="Several sections where people usually need only one at a time, like policy questions."
        >
          <Example frameClassName="block">
            <Accordion defaultValue={["late-fee"]}>
              <AccordionItem value="late-fee">
                <AccordionTrigger>
                  When does the late fee apply?
                </AccordionTrigger>
                <AccordionContent>
                  A ৳100 late fee is added to tuition not paid by the 10th of
                  the month.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="attendance">
                <AccordionTrigger>
                  What is the minimum attendance?
                </AccordionTrigger>
                <AccordionContent>
                  Students need 75% attendance in a term to sit the final exam.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="transfer">
                <AccordionTrigger>
                  How do I request a section transfer?
                </AccordionTrigger>
                <AccordionContent>
                  The guardian submits a request to the class teacher, who
                  forwards it to the academic office.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Example>
        </Block>

        <Block
          name="Collapsible"
          when="Hide secondary detail behind one toggle, like older notes on a student."
        >
          <Example frameClassName="block">
            <CollapsibleNotes />
          </Example>
        </Block>

        <Block
          name="Separator"
          when="A quiet line between groups of content, across or between items in a row."
        >
          <Example
            title="horizontal"
            frameClassName="flex-col items-stretch gap-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Ayesha Rahman</span>
              <span className="text-sm text-muted-foreground">
                Class 7 · Section B
              </span>
            </div>
            <Separator />
            <span className="text-sm text-muted-foreground">
              Guardian: Karim Rahman
            </span>
          </Example>
          <Example title="vertical">
            <div className="flex h-5 items-center gap-3 text-sm">
              <span>Roll 01</span>
              <Separator orientation="vertical" />
              <span>Morning shift</span>
              <Separator orientation="vertical" />
              <span>Bangla medium</span>
            </div>
          </Example>
        </Block>

        <Block
          name="Aspect ratio"
          when="Keep media in shape before it loads, like a photo on a notice."
        >
          <Example title="16 : 9" frameClassName="block">
            <AspectRatio
              ratio={16 / 9}
              className="flex items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground"
            >
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="size-6" />
                <span className="text-sm">Annual sports day photo</span>
              </div>
            </AspectRatio>
          </Example>
        </Block>

        <Block
          name="Carousel"
          when="A few cards of the same kind to swipe through on a phone, like this week's notices."
        >
          <Example title="notices" frameClassName="block px-12">
            <Carousel opts={{ align: "start" }}>
              <CarouselContent>
                {NOTICES.map((notice) => (
                  <CarouselItem key={notice.title} className="sm:basis-1/2">
                    <Card size="sm" className="h-full">
                      <CardHeader>
                        <CardTitle>{notice.title}</CardTitle>
                        <CardDescription>{notice.body}</CardDescription>
                      </CardHeader>
                      <CardContent className="mt-auto">
                        <Badge variant="outline">{notice.tag}</Badge>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-10" />
              <CarouselNext className="-right-10" />
            </Carousel>
          </Example>
        </Block>

        <Block
          name="Scroll area"
          when="A long list inside a fixed height, so the page around it stays put."
        >
          <Example title="Class 7 · Section B" frameClassName="block p-0">
            <ScrollArea className="h-64">
              <ul className="flex flex-col p-2">
                {STUDENTS.map((name, index) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="w-6 font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Avatar size="sm">
                      <AvatarFallback>{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </Example>
        </Block>

        <Block
          name="Chart"
          when="Trends over time, like monthly fee collection against what is still outstanding."
          wide
        >
          <Example title="fee collection · Jan to Jun" frameClassName="block">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-72 w-full"
            >
              <BarChart accessibilityLayer data={FEE_COLLECTION}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value: number) => `৳${value / 1000}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="collected"
                  fill="var(--color-collected)"
                  radius={4}
                />
                <Bar dataKey="due" fill="var(--color-due)" radius={4} />
              </BarChart>
            </ChartContainer>
          </Example>
        </Block>

        <Block
          name="Resizable"
          when="Side-by-side panes people size themselves, like a student list next to a profile."
          wide
        >
          <Example
            title="drag the handles"
            frameClassName="block overflow-hidden p-0"
          >
            <ResizablePanelGroup orientation="horizontal" className="min-h-56">
              <ResizablePanel defaultSize="30%" minSize="20%">
                <div className="flex h-full flex-col gap-1 p-4">
                  <span className="text-sm font-medium">Sections</span>
                  <span className="text-sm text-muted-foreground">
                    Class 7 · A, B, C
                  </span>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="40%" minSize="20%">
                <div className="flex h-full flex-col gap-1 p-4">
                  <span className="text-sm font-medium">Students</span>
                  <span className="text-sm text-muted-foreground">
                    41 in Section B
                  </span>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="30%" minSize="20%">
                <div className="flex h-full flex-col gap-1 p-4">
                  <span className="text-sm font-medium">Ayesha Rahman</span>
                  <span className="text-sm text-muted-foreground">
                    Roll 01 · 97% attendance
                  </span>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </Example>
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}

function CollapsibleNotes() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Notes on Rafi Ahmed</span>
        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
          {open ? "Hide 2 older" : "Show 2 older"}
          <ChevronDownIcon
            data-icon="inline-end"
            className={cn("transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        19 Oct: absent, guardian replied &quot;fever&quot;.
      </p>
      <CollapsibleContent className="flex flex-col gap-2">
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          2 Oct: late twice this week.
        </p>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          14 Sep: moved from Section A.
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
