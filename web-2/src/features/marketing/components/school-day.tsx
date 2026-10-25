import { Progress } from "~/components/ui/progress"
import { Separator } from "~/components/ui/separator"
import { Container, Section, SectionIntro } from "./section"

function Lines({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const MOMENTS: {
  time: string
  who: string
  title: string
  body: string
  proof: React.ReactNode
}[] = [
  {
    time: "7:50",
    who: "Class teacher",
    title: "Attendance is taken before the first bell",
    body: "The roster opens with everyone present. The teacher taps the two or three exceptions and saves, from the phone in their hand.",
    proof: (
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Class 6 A saved.</span>{" "}
        39 present, 1 absent, 2 late.
      </p>
    ),
  },
  {
    time: "8:30",
    who: "Principal",
    title: "The principal sees who hasn't submitted",
    body: "Today's attendance by class, and the sections still waiting, without walking the corridors.",
    proof: (
      <div className="text-sm">
        <p className="font-semibold">4 of 38 sections not submitted</p>
        <p className="text-muted-foreground">
          Class 3 B, Class 7 A, Class 9 C, Class 10 B
        </p>
      </div>
    ),
  },
  {
    time: "10:00",
    who: "Guardian",
    title: "Guardians know about an absence the same morning",
    body: "Rafi's absence shows up in his guardian's portal, in Bangla or English. If he turns up late and is marked in, the record updates.",
    proof: (
      <p className="rounded-xl bg-secondary px-4 py-3 font-bangla text-sm leading-relaxed text-secondary-foreground">
        প্রিয় অভিভাবক, রাফি আহমেদ (৬ষ্ঠ ক, রোল ৭) আজ ১৯ অক্টোবর বিদ্যালয়ে
        অনুপস্থিত।
      </p>
    ),
  },
  {
    time: "13:15",
    who: "Accountant",
    title: "A parent pays for two children in one go",
    body: "October tuition for both children at the counter, with the sibling discount already applied. One numbered receipt, and the dues list updates at once.",
    proof: (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">
          Receipt 004817, paid at the counter
        </p>
        <Lines
          rows={[
            ["Nusrat, Class 8 B", "৳2,400"],
            ["Tanvir, Class 4 A", "৳1,800"],
            ["Sibling discount", "−৳180"],
          ]}
        />
        <Separator />
        <div className="flex justify-between text-sm font-semibold">
          <span>Paid</span>
          <span className="tabular-nums">৳4,020</span>
        </div>
      </div>
    ),
  },
  {
    time: "17:00",
    who: "Owner",
    title: "The owner checks the day's collection",
    body: "Collected today by counter and collector, with what is still due. Every receipt is numbered in order, so the cash in the drawer has to match.",
    proof: (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm font-semibold">
          <span>Collected today</span>
          <span className="tabular-nums">৳2,52,740</span>
        </div>
        <Progress
          value={56}
          aria-label="Counter 1 share of today's collection"
        />
        <Lines
          rows={[
            ["Counter 1, Rahima", "৳1,42,500"],
            ["Counter 2, Jalal", "৳86,240"],
            ["Bank deposit slips", "৳24,000"],
          ]}
        />
      </div>
    ),
  },
]

export function SchoolDay() {
  return (
    <Section id="how-it-works" className="bg-card">
      <Container className="flex flex-col gap-12">
        <SectionIntro
          eyebrow="How it works"
          title="A Monday at Shapla Model School"
        >
          Five moments from one school day, and who they save time for.
        </SectionIntro>
        <ol className="border-t-2 border-foreground">
          {MOMENTS.map((m) => (
            <li
              key={m.time}
              className="grid gap-4 border-b py-8 md:grid-cols-[8rem_1fr] lg:grid-cols-[9rem_1fr_21rem] lg:gap-8"
            >
              <div>
                <p className="font-display text-4xl text-primary">{m.time}</p>
                <p className="text-sm text-muted-foreground">{m.who}</p>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold">{m.title}</h3>
                <p className="leading-relaxed text-muted-foreground">
                  {m.body}
                </p>
              </div>
              <div className="md:col-start-2 lg:col-start-3">{m.proof}</div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
