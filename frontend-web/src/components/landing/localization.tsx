import { Banknote, FileCheck2, Languages, Signal } from "lucide-react";
import { Section, SectionHeading } from "../ui/section";

const POINTS = [
  {
    icon: Languages,
    title: "বাংলা and English",
    text: "Every screen, report card and receipt in both languages. Each person picks their own.",
  },
  {
    icon: FileCheck2,
    title: "Board rules, built in",
    text: "The GPA 5.0 scale, the 4th-subject bonus and per-component pass marks, with GPA 4.0, Cambridge and madrasa scales available.",
  },
  {
    icon: Banknote,
    title: "Taka, the way it's written",
    text: "Amounts in lakhs (৳১১,২০,০০০), Bangla numerals on Bangla screens, and the Dhaka time zone.",
  },
  {
    icon: Signal,
    title: "Light on data",
    text: "Pages are kept small so they open on a slow mobile connection and a mid-range Android phone.",
  },
];

export function Localization() {
  return (
    <Section labelledBy="local-title" tone="mint" className="grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <div>
        <SectionHeading id="local-title" eyebrow="Made for Bangladesh" title="Built for how schools here actually work">
          Global ERPs weren&apos;t designed for board-exam grading, Bangla report cards or taka in
          lakhs. This one was, and it&apos;s ready to grow beyond Bangladesh too.
        </SectionHeading>
        <p lang="bn" className="display mt-10 text-[2.6rem] text-forest-2 sm:text-[3.2rem]">
          আপনার স্কুল, আপনার ভাষায়।
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {POINTS.map((p) => (
          <li key={p.title} className="rounded-2xl bg-paper p-6 ring-1 ring-mint-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-mint text-forest-2">
              <p.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-6 text-lg font-semibold">{p.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{p.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
