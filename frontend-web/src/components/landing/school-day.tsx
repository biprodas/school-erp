import type { ReactNode } from "react";
import { Section, SectionHeading } from "../ui/section";

type Moment = {
  time: string;
  who: string;
  title: string;
  text: string;
  detail: ReactNode;
};

const MOMENTS: Moment[] = [
  {
    time: "7:50",
    who: "Class teacher",
    title: "Attendance is taken before the first bell",
    text: "The roster opens with everyone present. The teacher taps the two or three exceptions and saves, from the phone in their hand.",
    detail: (
      <p className="text-sm">
        <span className="font-semibold">Class 6 A saved.</span>{" "}
        <span className="text-ink-2">39 present, 1 absent, 2 late.</span>
      </p>
    ),
  },
  {
    time: "8:30",
    who: "Principal",
    title: "The principal sees who hasn't submitted",
    text: "Today's attendance by class, and the sections still waiting, without walking the corridors.",
    detail: (
      <div className="text-sm">
        <p className="font-semibold">4 of 38 sections not submitted</p>
        <p className="mt-1 text-ink-2">Class 3 B, Class 7 A, Class 9 C, Class 10 B</p>
      </div>
    ),
  },
  {
    time: "10:00",
    who: "Guardian",
    title: "Guardians know about an absence the same morning",
    text: "Rafi's absence shows up in his guardian's portal, in Bangla or English. If he turns up late and is marked in, the record updates.",
    detail: (
      <p lang="bn" className="rounded-2xl rounded-tl-sm bg-mint px-4 py-2.5 text-[15px] leading-snug text-forest">
        প্রিয় অভিভাবক, রাফি আহমেদ (৬ষ্ঠ ক, রোল ৭) আজ ১৯ অক্টোবর বিদ্যালয়ে অনুপস্থিত।
      </p>
    ),
  },
  {
    time: "13:15",
    who: "Accountant",
    title: "A parent pays for two children in one go",
    text: "October tuition for both children at the counter, with the sibling discount already applied. One numbered receipt, and the dues list updates at once.",
    detail: (
      <div className="text-sm">
        <p className="mb-1.5 font-semibold">Receipt 004817, paid at the counter</p>
        <Row label="Nusrat, Class 8 B" value="৳2,400" />
        <Row label="Tanvir, Class 4 A" value="৳1,800" />
        <Row label="Sibling discount" value="−৳180" />
        <div className="mt-2 border-t border-line pt-2">
          <Row label="Paid" value="৳4,020" bold />
        </div>
      </div>
    ),
  },
  {
    time: "17:00",
    who: "Owner",
    title: "The owner checks the day's collection",
    text: "Collected today by counter and collector, with what is still due. Every receipt is numbered in order, so the cash in the drawer has to match.",
    detail: (
      <div className="text-sm">
        <div className="flex justify-between font-semibold">
          <span>Collected today</span>
          <span className="tabular-nums">৳2,52,740</span>
        </div>
        <div className="mt-2 mb-2 flex h-1.5 overflow-hidden rounded-full bg-line">
          <span className="bg-forest-2" style={{ width: "56%" }} />
          <span className="bg-sage" style={{ width: "34%" }} />
          <span className="bg-mint-2" style={{ width: "10%" }} />
        </div>
        <Row label="Counter 1, Rahima" value="৳1,42,500" />
        <Row label="Counter 2, Jalal" value="৳86,240" />
        <Row label="Bank deposit slips" value="৳24,000" />
      </div>
    ),
  },
];

export function SchoolDay() {
  return (
    <Section id="how-it-works" labelledBy="day-title" tone="paper">
      <SectionHeading id="day-title" eyebrow="How it works" title="A Monday at Shapla Model School">
        Five moments from one school day, and who they save time for.
      </SectionHeading>

      <ol className="mt-10 border-t-2 border-ink">
        {MOMENTS.map((m) => (
          <li
            key={m.time}
            className="grid gap-x-8 gap-y-3 border-b border-line py-6 md:grid-cols-[7rem_minmax(0,1fr)] lg:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,21rem)]"
          >
            <div>
              <p className="display text-[2.4rem] leading-none">{m.time}</p>
              <p className="mt-1.5 text-sm text-ink-2">{m.who}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">{m.title}</h3>
              <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-ink-2">{m.text}</p>
            </div>
            <div className="md:col-start-2 lg:col-start-3 lg:pt-0.5">{m.detail}</div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? "font-semibold" : "text-ink-2"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
