import {
  BarChart3,
  BookOpen,
  Bus,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  IdCard,
  LineChart,
  Library,
  Megaphone,
  MessageSquareText,
  Smartphone,
  Users,
  Wallet,
  Briefcase,
} from "lucide-react";
import { Section, SectionHeading } from "../ui/section";

const MODULES = [
  {
    icon: Users,
    name: "Students and guardians",
    text: "Profiles, guardians, documents and enrolment, imported from your existing Excel list.",
  },
  {
    icon: ClipboardCheck,
    name: "Attendance",
    text: "Marked on a phone in under a minute, with holidays and student leave in the same place.",
  },
  {
    icon: GraduationCap,
    name: "Exams and results",
    text: "GPA 5.0 and other scales, mark entry, tabulation, merit positions and report cards.",
  },
  {
    icon: Wallet,
    name: "Fees and receipts",
    text: "Fee heads, discounts, monthly invoices, counter collection, numbered receipts and dues.",
  },
  {
    icon: Smartphone,
    name: "Guardian portal",
    text: "Guardians and students see attendance, results, dues and notices on the web.",
  },
  {
    icon: Megaphone,
    name: "Notices",
    text: "Notices to the whole school, a class or a section, in the portal and by email.",
  },
  {
    icon: IdCard,
    name: "Staff directory",
    text: "Teachers and staff with departments and designations, and the classes they teach.",
  },
  {
    icon: BarChart3,
    name: "Reports",
    text: "Attendance registers, result sheets, and collection and dues reports, ready to print.",
  },
];

const COMING = [
  { icon: CreditCard, name: "Online payments" },
  { icon: MessageSquareText, name: "SMS alerts" },
  { icon: BookOpen, name: "Homework and LMS" },
  { icon: Briefcase, name: "HR and payroll" },
  { icon: Library, name: "Library" },
  { icon: Bus, name: "Transport" },
  { icon: LineChart, name: "Advanced analytics" },
];

export function Modules() {
  return (
    <Section id="modules" labelledBy="modules-title">
      <SectionHeading id="modules-title" eyebrow="Modules" title="Everything the school runs on, already connected">
        A payment updates the dues list, an absence reaches the guardian, a published result lands
        in the portal. No re-typing between systems.
      </SectionHeading>

      {/* One block: 1px gaps over a line-coloured background draw the dividers */}
      <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => (
          <li key={m.name} className="group bg-paper p-5 hover:bg-mint/70">
            <span className="flex size-10 items-center justify-center rounded-xl bg-mint text-forest-2 group-hover:bg-sage">
              <m.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-semibold group-hover:text-forest-2">
              {m.name}
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{m.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-dashed border-mint-2 bg-mint/50 p-5 sm:flex-row sm:items-center">
        <h3 className="shrink-0 text-[15px] font-semibold">
          Coming soon
          <span className="block text-sm font-normal text-ink-2">Not available yet</span>
        </h3>
        <ul className="flex flex-wrap gap-2">
          {COMING.map((c) => (
            <li
              key={c.name}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-sm text-ink-2 ring-1 ring-line"
            >
              <c.icon className="size-3.5" aria-hidden="true" />
              {c.name}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
