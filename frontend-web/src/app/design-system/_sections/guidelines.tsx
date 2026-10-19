"use client"

import { BellIcon, CheckIcon, SaveIcon, UserSearchIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ButtonLink } from "~/components/ui/button-link"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { cn } from "~/lib/utils"
import { Block, BlockGrid, Example, ShowcaseSection } from "../_showcase/block"

/* ------------------------------------------------------------------ */
/* Do and don't                                                        */
/* ------------------------------------------------------------------ */

function Pair({
  rule,
  doExample,
  dontExample,
  doFrame,
  dontFrame,
}: {
  rule: string
  doExample: ReactNode
  dontExample: ReactNode
  doFrame?: string
  dontFrame?: string
}) {
  return (
    <Block name={rule} when="From DESIGN.md, Do's and Don'ts." wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="type-label text-success">Do</p>
          <Example frameClassName={doFrame}>{doExample}</Example>
        </div>
        <div className="flex flex-col gap-2">
          <p className="type-label text-destructive">Don&apos;t</p>
          <Example frameClassName={dontFrame}>{dontExample}</Example>
        </div>
      </div>
    </Block>
  )
}

export function DosAndDonts() {
  return (
    <ShowcaseSection
      id="dos-and-donts"
      eyebrow="Rules"
      title="Do and don't"
      description="The four rules that are easiest to break. Each one is rendered both ways."
    >
      <div className="flex flex-col gap-14">
        <Pair
          rule="One primary action per group"
          doExample={
            <>
              <Button>Save register</Button>
              <Button variant="outline">Mark all present</Button>
            </>
          }
          dontExample={
            <>
              <Button>Save register</Button>
              <Button>Mark all present</Button>
            </>
          }
        />
        <Pair
          rule="Marigold only for the key action on a forest surface"
          doFrame="dark bg-band text-foreground ring-0"
          doExample={
            <>
              <Button variant="highlight">Start 30-day free trial</Button>
              <Button variant="outline">Talk to us</Button>
            </>
          }
          dontExample={
            <>
              <Button variant="highlight">Start 30-day free trial</Button>
              <Badge variant="highlight">New</Badge>
            </>
          }
        />
        <Pair
          rule="Red only marks absences, dues and errors"
          doExample={
            <>
              <Badge variant="success">Present</Badge>
              <Badge variant="destructive">Absent</Badge>
              <Badge variant="destructive">৳1,200 overdue</Badge>
            </>
          }
          dontExample={
            <>
              <Badge variant="destructive">Popular</Badge>
              <Badge variant="destructive">Results published</Badge>
            </>
          }
        />
        <Pair
          rule="Cards sit on hairline rings, not shadows"
          doFrame="bg-background"
          dontFrame="bg-background"
          doExample={
            <Card size="sm" className="w-full max-w-xs">
              <CardHeader>
                <CardTitle>Class 7-B</CardTitle>
                <CardDescription>38 of 41 present today</CardDescription>
              </CardHeader>
            </Card>
          }
          dontExample={
            <Card size="sm" className="w-full max-w-xs shadow-xl ring-0">
              <CardHeader>
                <CardTitle>Class 7-B</CardTitle>
                <CardDescription>38 of 41 present today</CardDescription>
              </CardHeader>
            </Card>
          }
        />
      </div>
    </ShowcaseSection>
  )
}

/* ------------------------------------------------------------------ */
/* Recipes                                                             */
/* ------------------------------------------------------------------ */

type Plan = {
  name: string
  forWho: string
  price: string
  priceNote: string
  intro: string
  items: string[]
  cta: string
  featured?: boolean
}

const PLANS: Plan[] = [
  {
    name: "Basic",
    forWho: "Small schools",
    price: "৳20",
    priceNote: "per student a month",
    intro: "Everything in Free, plus",
    items: [
      "Fees, receipts and dues",
      "bKash and card payments",
      "Report cards and guardian portal",
    ],
    cta: "Start free trial",
  },
  {
    name: "Standard",
    forWho: "Mid-size schools",
    price: "৳35",
    priceNote: "per student a month",
    intro: "Everything in Basic, plus",
    items: ["Custom roles", "Your own domain", "Homework, timetable and payroll as they arrive"],
    cta: "Start 30-day free trial",
    featured: true,
  },
]

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <Card
      className={cn(
        "relative overflow-visible",
        plan.featured && "dark bg-band text-foreground shadow-feature ring-0"
      )}
    >
      {plan.featured ? (
        <Badge variant="highlight" className="absolute -top-3 left-6">
          Included in your free trial
        </Badge>
      ) : null}
      <CardHeader>
        <CardTitle className="type-title">{plan.name}</CardTitle>
        <CardDescription>{plan.forWho}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="type-display-md">{plan.price}</p>
          <p className="text-sm text-muted-foreground">{plan.priceNote}</p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">{plan.intro}</p>
          <ul className="flex flex-col gap-2">
            {plan.items.map((item) => (
              <li key={item} className="type-body flex items-start gap-2.5 text-muted-foreground">
                <CheckIcon
                  className={cn("mt-1 size-4 shrink-0", plan.featured ? "text-primary" : "text-success")}
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardContent>
        <ButtonLink
          href="#recipes"
          variant={plan.featured ? "default" : "outline"}
          className="w-full"
        >
          {plan.cta}
        </ButtonLink>
      </CardContent>
    </Card>
  )
}

type Status = "present" | "absent" | "late"

const STUDENTS: { roll: number; name: string; nameBn: string; status: Status; note: string }[] = [
  { roll: 1, name: "Ayesha Siddiqua", nameBn: "আয়েশা সিদ্দিকা", status: "present", note: "" },
  { roll: 2, name: "Rafi Ahmed", nameBn: "রাফি আহমেদ", status: "absent", note: "Guardian notified 9:15 AM" },
  { roll: 3, name: "Nusrat Jahan", nameBn: "নুসরাত জাহান", status: "present", note: "" },
  { roll: 4, name: "Tanvir Hossain", nameBn: "তানভীর হোসেন", status: "late", note: "Arrived 8:42 AM" },
  { roll: 5, name: "Sumaiya Akter", nameBn: "সুমাইয়া আক্তার", status: "present", note: "" },
  { roll: 6, name: "Mahin Chowdhury", nameBn: "মাহিন চৌধুরী", status: "present", note: "" },
]

const STATUS_BADGE: Record<Status, { label: string; variant: "success" | "destructive" | "warning" }> = {
  present: { label: "Present", variant: "success" },
  absent: { label: "Absent", variant: "destructive" },
  late: { label: "Late", variant: "warning" },
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "leave", label: "On leave" },
]

function AttendanceScreen() {
  const [filter, setFilter] = useState("all")
  const rows = filter === "all" ? STUDENTS : STUDENTS.filter((student) => student.status === filter)
  const present = STUDENTS.filter((student) => student.status !== "absent").length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-title">Class 7-B · Section A</CardTitle>
        <CardDescription>
          Sunday, 19 October · {present} of {STUDENTS.length} in school
        </CardDescription>
        <CardAction>
          <Button>
            <SaveIcon data-icon="inline-start" />
            Save register
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[filter]}
          onValueChange={(value) => setFilter(value[0] ?? "all")}
          aria-label="Filter by status"
          className="flex-wrap"
        >
          {FILTERS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {rows.length === 0 ? (
          <Empty className="rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserSearchIcon />
              </EmptyMedia>
              <EmptyTitle>No students match</EmptyTitle>
              <EmptyDescription>
                Nobody in 7-B is marked {FILTERS.find((item) => item.value === filter)?.label.toLowerCase()} today.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                Show all students
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Roll</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((student) => (
                <TableRow key={student.roll}>
                  <TableCell className="type-numeral">{String(student.roll).padStart(2, "0")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{student.name}</span>
                      <span lang="bn" className="text-xs text-muted-foreground">
                        {student.nameBn}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[student.status].variant}>
                      {STATUS_BADGE[student.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {student.note || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <p className="text-sm text-muted-foreground">Showing 1–6 of 41 students</p>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#recipes" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#recipes" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#recipes">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#recipes">7</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#recipes" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
  )
}

export function Recipes() {
  return (
    <ShowcaseSection
      id="recipes"
      eyebrow="Composition"
      title="Recipes"
      description="The landing page's own pieces, rebuilt from components and role tokens only. If one of these needs a raw color, the token map is incomplete."
    >
      <BlockGrid>
        <Block
          name="Pricing tiers"
          when="Plan cards on paper. The featured tier is a forest card with dark tokens, so its primary button turns marigold."
          wide
        >
          <div className="grid gap-6 pt-3 sm:grid-cols-2 lg:max-w-3xl">
            {PLANS.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>
        </Block>

        <Block name="Section heading" when="Eyebrow, display head and lead paragraph at the top of each band.">
          <Example frameClassName="block bg-background">
            <div className="flex max-w-xl flex-col gap-4">
              <p className="type-eyebrow text-primary">Pricing</p>
              <h4 className="type-display-lg">Pay only for the students you have</h4>
              <p className="type-lead text-muted-foreground">
                One price per active student each month. Pay for the year and get two months free.
              </p>
            </div>
          </Example>
        </Block>

        <Block
          name="Guardian notification"
          when="The SMS a guardian gets when the register is saved. A dark card, with marigold only on the icon."
        >
          <Example frameClassName="bg-background">
            <Card size="sm" className="dark w-full max-w-64 bg-band text-foreground shadow-xl ring-0">
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <BellIcon className="size-3.5 text-highlight" aria-hidden="true" />
                  Guardian app · SMS
                </CardDescription>
                <CardTitle lang="bn" className="text-[15px] leading-snug font-normal">
                  আজ রাফি স্কুলে অনুপস্থিত। কারণ জানাতে উত্তর দিন।
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="type-caption text-subtle-foreground">Sent automatically at 9:15 AM</p>
              </CardContent>
            </Card>
          </Example>
        </Block>

        <Block
          name="Example screen: attendance register"
          when="A class teacher's register in the school dashboard. Filter by status; pick On leave to see the empty state."
          wide
        >
          <AttendanceScreen />
        </Block>
      </BlockGrid>
    </ShowcaseSection>
  )
}
