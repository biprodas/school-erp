import { CheckIcon } from "lucide-react"

import { Card } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { cn } from "~/lib/utils"
import { Container, DisplayHeading, Eyebrow, Lead } from "./section"

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone?: "alert"
}) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "alert" && "text-destructive"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

const COLLECTION = [
  { month: "May", value: 62 },
  { month: "Jun", value: 70 },
  { month: "Jul", value: 58 },
  { month: "Aug", value: 72 },
  { month: "Sep", value: 78 },
  { month: "Oct", value: 88 },
]

function OwnerPreview() {
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Present today" value="94.2%" note="1,268 of 1,346" />
        <Stat label="Collected today" value="৳2.53L" note="2 counters" />
        <Stat
          label="Still due"
          value="৳3.1L"
          note="214 students"
          tone="alert"
        />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          Fee collection, last 6 months
        </p>
        <div className="flex h-24 items-end gap-2">
          {COLLECTION.map((bar, i) => (
            <div
              key={bar.month}
              className="flex h-full flex-1 flex-col justify-end gap-1"
            >
              <div
                className={cn(
                  "rounded-t-md",
                  i === COLLECTION.length - 1 ? "bg-chart-1" : "bg-chart-2"
                )}
                style={{ height: `${bar.value}%` }}
              />
              <span className="text-center text-xs text-muted-foreground">
                {bar.month}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold">Upcoming exams</p>
          <ul className="flex flex-col gap-1">
            <li className="flex justify-between">
              Class test, Math 8
              <span className="text-muted-foreground">24 Oct</span>
            </li>
            <li className="flex justify-between">
              Half-yearly, 6 to 10
              <span className="text-muted-foreground">9 Nov</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold">Recent activity</p>
          <ul className="flex flex-col gap-1">
            <li>Receipt 004817, ৳4,020</li>
            <li>Notice: exam routine</li>
            <li>New admission, Class 6 C</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function ListPreview({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="flex flex-col p-2 text-sm">
      {rows.map(([label, value]) => (
        <li
          key={label}
          className="flex justify-between gap-4 rounded-lg px-3 py-2.5 odd:bg-muted/60"
        >
          <span>{label}</span>
          <span className="text-muted-foreground tabular-nums">{value}</span>
        </li>
      ))}
    </ul>
  )
}

const ROLES = [
  {
    value: "owners",
    label: "Owners",
    title: "The whole school's numbers, on your phone",
    points: [
      "Today's attendance, collection and dues the moment you sign in",
      "Fee collection by month, and the exams coming up",
      "Every payment, admission and published notice as it happens",
    ],
    greeting: "Good afternoon",
    preview: <OwnerPreview />,
  },
  {
    value: "principals",
    label: "Principals",
    title: "Every class at a glance, without the corridor walk",
    points: [
      "Which sections have and haven't taken attendance",
      "Marks waiting for approval, and results ready to publish",
      "Notices to the whole school, a class or a section",
    ],
    greeting: "Today, 8:30",
    preview: (
      <ListPreview
        rows={[
          ["Sections submitted", "34 of 38"],
          ["Marks awaiting approval", "6 subjects"],
          ["Teachers on leave", "2"],
          ["Notices this week", "3"],
        ]}
      />
    ),
  },
  {
    value: "teachers",
    label: "Teachers",
    title: "Only your classes, and nothing to retype",
    points: [
      "Take attendance for your section in under a minute",
      "Enter CQ, MCQ and practical marks in one grid",
      "See your routine and the notices meant for you",
    ],
    greeting: "Your classes today",
    preview: (
      <ListPreview
        rows={[
          ["Class 6 A, Attendance", "Saved 7:52"],
          ["Class 8 B, Mathematics", "Period 2"],
          ["Class 9 Science, Physics", "Period 4"],
          ["Half-yearly marks", "Due 30 Oct"],
        ]}
      />
    ),
  },
  {
    value: "accountants",
    label: "Accountants",
    title: "A counter that balances itself",
    points: [
      "Collect fees for several children in one receipt",
      "Discounts and waivers applied before you take the cash",
      "Dues list and daily collection report, ready to print",
    ],
    greeting: "Counter 1",
    preview: (
      <ListPreview
        rows={[
          ["Receipts today", "86"],
          ["Collected", "৳1,42,500"],
          ["Cancelled, with reason", "1"],
          ["Next receipt number", "004818"],
        ]}
      />
    ),
  },
  {
    value: "students",
    label: "Students",
    title: "Results and routine without asking the office",
    points: [
      "Published results and report cards",
      "Class routine and exam schedule",
      "Notices for their class",
    ],
    greeting: "Tahmid Hasan, Class 9",
    preview: (
      <ListPreview
        rows={[
          ["Half-yearly GPA", "4.79"],
          ["Attendance this month", "96%"],
          ["Next exam", "Physics, 9 Nov"],
          ["New notices", "2"],
        ]}
      />
    ),
  },
  {
    value: "guardians",
    label: "Guardians",
    title: "Each child's day, in Bangla or English",
    points: [
      "Attendance the same morning it is taken",
      "Dues, receipts and published results",
      "One login for children at different schools",
    ],
    greeting: "Your children",
    preview: (
      <ListPreview
        rows={[
          ["Nusrat, Class 8 B", "Present"],
          ["Tanvir, Class 4 A", "Present"],
          ["October fees", "Paid ৳4,020"],
          ["Half-yearly results", "Published"],
        ]}
      />
    ),
  },
]

export function Roles() {
  return (
    <section
      id="roles"
      className="scroll-mt-16 bg-brand py-20 text-brand-foreground sm:py-24"
    >
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-highlight">One platform, every role</Eyebrow>
          <DisplayHeading className="max-w-3xl">
            Everyone sees what they need, and nothing they don&apos;t
          </DisplayHeading>
          <Lead className="text-brand-foreground/75">
            Roles decide what each person can see and change. Start from the
            standard roles, or copy one and adjust it.
          </Lead>
        </div>
        <Tabs defaultValue="owners" className="gap-10">
          <TabsList className="h-auto! flex-wrap justify-start gap-2 bg-transparent p-0">
            {ROLES.map((role) => (
              <TabsTrigger
                key={role.value}
                value={role.value}
                className="h-9 flex-none rounded-full border-brand-foreground/25 px-4 text-brand-foreground/85 hover:text-brand-foreground dark:text-brand-foreground/85 data-active:border-highlight data-active:bg-highlight data-active:text-highlight-foreground dark:data-active:border-highlight dark:data-active:bg-highlight dark:data-active:text-highlight-foreground"
              >
                {role.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ROLES.map((role) => (
            <TabsContent
              key={role.value}
              value={role.value}
              className="grid items-center gap-10 lg:grid-cols-2"
            >
              <div className="flex flex-col gap-6">
                <h3 className="text-3xl font-semibold text-balance">
                  {role.title}
                </h3>
                <ul className="flex flex-col gap-3 text-base">
                  {role.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <CheckIcon className="mt-1 size-4 shrink-0 text-highlight" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <Card className="gap-0 py-0 shadow-2xl">
                <div className="flex justify-between border-b px-5 py-3 text-sm">
                  <span className="font-semibold">{role.greeting}</span>
                  <span className="text-muted-foreground">
                    Shapla Model School
                  </span>
                </div>
                {role.preview}
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </Container>
    </section>
  )
}
