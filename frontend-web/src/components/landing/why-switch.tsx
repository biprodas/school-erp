import { Check, X } from "lucide-react";
import { Section, SectionHeading } from "../ui/section";

const ROWS = [
  {
    today: "Fees collected over the counter and reconciled by hand",
    after: "Monthly invoices, numbered receipts and a dues list that updates itself",
  },
  {
    today: "Results tabulated in Excel, with GPA errors and late report cards",
    after: "Marks become GPA as they are typed, and report cards print by section",
  },
  {
    today: "Guardians hear about an absence days later, if at all",
    after: "Guardians see the absence in the portal the same morning",
  },
  {
    today: "Notices scattered across SMS, Facebook groups and paper",
    after: "One notice reaches the right class in the portal and by email",
  },
  {
    today: "Records on one office PC, open only from that desk",
    after: "Stored online and open from any phone, by the people allowed to see them",
  },
];

export function WhySwitch() {
  return (
    <Section labelledBy="why-title">
      <SectionHeading id="why-title" eyebrow="Why schools switch" title="Registers and spreadsheets cost more than they seem">
        Most of a school office&apos;s week goes on copying, adding up and chasing. That work is
        what Kampasy takes over.
      </SectionHeading>

      <div className="mt-12 overflow-hidden rounded-2xl bg-paper ring-1 ring-line shadow-[0_24px_48px_-32px_rgba(20,63,48,0.3)]">
        <div className="hidden grid-cols-2 text-[15px] font-semibold md:grid">
          <p className="px-6 py-4">Today</p>
          <p className="bg-mint/60 px-6 py-4 text-secondary-foreground">With Kampasy</p>
        </div>
        <ul>
          {ROWS.map((row) => (
            <li key={row.today} className="grid border-t border-line md:grid-cols-2">
              <p className="flex gap-3 px-6 pt-4 pb-2 text-[15px] text-ink-2 md:py-4">
                <X className="mt-0.5 size-4 shrink-0 text-red" aria-label="Today:" />
                {row.today}
              </p>
              <p className="flex gap-3 px-6 pt-2 pb-4 text-[15px] font-medium md:bg-mint/60 md:py-4">
                <Check className="mt-0.5 size-4 shrink-0 text-forest-2" aria-label="With Kampasy:" />
                {row.after}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
