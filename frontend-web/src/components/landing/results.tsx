import { Section, SectionHeading } from "../ui/section";

const STEPS = [
  { name: "Draft", text: "Subject teacher enters marks" },
  { name: "Submitted", text: "Sent for checking" },
  { name: "Approved", text: "Principal approves, marks lock" },
  { name: "Published", text: "Guardians notified, report cards ready" },
];

const MARKS = [
  { subject: "Bangla", cq: 52, mcq: 26, grade: "A", point: 4 },
  { subject: "English", cq: 85, mcq: null, grade: "A+", point: 5 },
  { subject: "Mathematics", cq: 64, mcq: 28, grade: "A+", point: 5 },
  { subject: "Physics", cq: 49, mcq: 25, grade: "A", point: 4 },
  { subject: "Chemistry", cq: 55, mcq: 26, grade: "A+", point: 5 },
  { subject: "Biology", cq: 44, mcq: 24, grade: "A-", point: 3.5 },
  { subject: "ICT", cq: 30, mcq: 58, grade: "A+", point: 5 },
];

const FOURTH = { subject: "Higher Mathematics", cq: 51, mcq: 25, grade: "A", point: 4 };

// Compulsory points plus the 4th subject's points above 2.0, over the compulsory count.
const GPA = (MARKS.reduce((sum, m) => sum + m.point, 0) + Math.max(0, FOURTH.point - 2)) / MARKS.length;

export function Results() {
  return (
    <Section labelledBy="results-title" tone="paper" className="grid items-start gap-14 lg:grid-cols-2 lg:gap-16">
      <div>
        <SectionHeading id="results-title" eyebrow="Exams and results" title="Results days after the last exam, not weeks">
          <p>
            Teachers enter CQ, MCQ and practical marks in a grid, and the grade appears as they
            type. Tabulation, GPA, merit position and failed subjects are worked out for the whole
            class at once.
          </p>
          <p className="mt-4">
            Bangladesh board rules are the default: an F in a compulsory subject makes the result
            F, and the 4th subject adds its points above 2.0. Schools on another scale set up their
            own.
          </p>
        </SectionHeading>

        <ol className="mt-10 border-t-2 border-ink">
          {STEPS.map((s, i) => (
            <li key={s.name} className="grid grid-cols-[1.75rem_7.5rem_minmax(0,1fr)] items-baseline border-b border-line py-3.5 text-[15px]">
              <span className="text-sm text-ink-3">{i + 1}</span>
              <span className="font-semibold">{s.name}</span>
              <span className="text-ink-2">{s.text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-3">
          After approval, only the principal can reopen marks, and the old and new values are both
          kept.
        </p>
      </div>

      <figure className="overflow-hidden rounded-2xl bg-paper ring-1 ring-line shadow-[0_30px_60px_-36px_rgba(20,63,48,0.35)] lg:mt-10">
        <figcaption className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <span className="font-semibold">Tahmid Hasan, Class 9 Science</span>
          <span className="text-sm text-ink-3">Half-yearly exam 2026</span>
        </figcaption>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th scope="col" className="px-5 py-3 font-medium">Subject</th>
                <th scope="col" className="px-2 py-3 text-right font-medium">CQ</th>
                <th scope="col" className="px-2 py-3 text-right font-medium">MCQ</th>
                <th scope="col" className="px-2 py-3 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-3 font-medium">Grade</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Point</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {MARKS.map((m) => (
                <MarkRow key={m.subject} {...m} />
              ))}
              <MarkRow {...FOURTH} note="4th subject, adds 2.00" highlight />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink">
                <th scope="row" colSpan={5} className="px-5 py-4 text-left font-semibold">
                  GPA
                </th>
                <td className="display px-5 py-4 text-right text-3xl text-forest-2">{GPA.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </figure>
    </Section>
  );
}

function MarkRow({
  subject,
  cq,
  mcq,
  grade,
  point,
  note,
  highlight = false,
}: {
  subject: string;
  cq: number;
  mcq: number | null;
  grade: string;
  point: number;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-line ${highlight ? "bg-mint/50" : ""}`}>
      <th scope="row" className="px-5 py-3 text-left font-normal">
        {subject}
        {note ? <span className="block text-xs text-ink-3">{note}</span> : null}
      </th>
      <td className="px-2 py-3 text-right">{cq}</td>
      <td className="px-2 py-3 text-right text-ink-2">{mcq ?? "–"}</td>
      <td className="px-2 py-3 text-right font-medium">{cq + (mcq ?? 0)}</td>
      <td className="px-4 py-3 font-semibold">{grade}</td>
      <td className="px-5 py-3 text-right">{point.toFixed(2)}</td>
    </tr>
  );
}
