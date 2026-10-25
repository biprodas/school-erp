import { Card } from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Container, Section, SectionIntro } from "./section"

const WORKFLOW = [
  ["Draft", "Subject teacher enters marks"],
  ["Submitted", "Sent for checking"],
  ["Approved", "Principal approves, marks lock"],
  ["Published", "Guardians notified, report cards ready"],
]

const MARKS: {
  subject: string
  note?: string
  cq: number
  mcq: number | null
  grade: string
  point: string
}[] = [
  { subject: "Bangla", cq: 52, mcq: 26, grade: "A", point: "4.00" },
  { subject: "English", cq: 85, mcq: null, grade: "A+", point: "5.00" },
  { subject: "Mathematics", cq: 64, mcq: 28, grade: "A+", point: "5.00" },
  { subject: "Physics", cq: 49, mcq: 25, grade: "A", point: "4.00" },
  { subject: "Chemistry", cq: 55, mcq: 26, grade: "A+", point: "5.00" },
  { subject: "Biology", cq: 44, mcq: 24, grade: "A-", point: "3.50" },
  { subject: "ICT", cq: 30, mcq: 58, grade: "A+", point: "5.00" },
  {
    subject: "Higher Mathematics",
    note: "4th subject, adds 2.00",
    cq: 51,
    mcq: 25,
    grade: "A",
    point: "4.00",
  },
]

export function Results() {
  return (
    <Section className="bg-card">
      <Container className="grid items-start gap-12 lg:grid-cols-[1fr_32rem]">
        <div className="flex flex-col gap-8">
          <SectionIntro
            eyebrow="Exams and results"
            title="Results days after the last exam, not weeks"
          >
            Teachers enter CQ, MCQ and practical marks in a grid, and the grade
            appears as they type. Tabulation, GPA, merit position and failed
            subjects are worked out for the whole class at once.
          </SectionIntro>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Board-exam rules are the default: an F in a compulsory subject makes
            the result F, and the 4th subject adds its points above 2.0. Schools
            on another scale set up their own.
          </p>
          <div>
            <ol className="border-t-2 border-foreground">
              {WORKFLOW.map(([step, detail], i) => (
                <li
                  key={step}
                  className="grid grid-cols-[1.5rem_7rem_1fr] border-b py-3.5 text-sm"
                >
                  <span className="text-muted-foreground">{i + 1}</span>
                  <span className="font-semibold">{step}</span>
                  <span className="text-muted-foreground">{detail}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">
              After approval, only the principal can reopen marks, and the old
              and new values are both kept.
            </p>
          </div>
        </div>

        <Card className="gap-0 py-0 shadow-xl shadow-primary/5">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4 text-sm">
            <span className="font-semibold">Tahmid Hasan, Class 9 Science</span>
            <span className="text-muted-foreground">Half-yearly exam 2026</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Subject</TableHead>
                <TableHead className="text-right">CQ</TableHead>
                <TableHead className="text-right">MCQ</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="pr-5 text-right">Point</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MARKS.map((row) => (
                <TableRow
                  key={row.subject}
                  className={row.note ? "bg-secondary/50" : undefined}
                >
                  <TableCell className="pl-5">
                    {row.subject}
                    {row.note && (
                      <span className="block text-xs text-muted-foreground">
                        {row.note}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.cq}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {row.mcq ?? "–"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {row.cq + (row.mcq ?? 0)}
                  </TableCell>
                  <TableCell className="font-semibold">{row.grade}</TableCell>
                  <TableCell className="pr-5 text-right tabular-nums">
                    {row.point}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-transparent">
              <TableRow>
                <TableCell colSpan={5} className="pl-5 font-semibold">
                  GPA
                </TableCell>
                <TableCell className="pr-5 text-right font-display text-3xl text-primary">
                  4.79
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      </Container>
    </Section>
  )
}
