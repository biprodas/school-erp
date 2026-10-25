import { CheckIcon, XIcon } from "lucide-react"

import { Card } from "~/components/ui/card"
import { BRAND } from "~/config/brand-config"
import { Container, Section, SectionIntro } from "./section"

const ROWS = [
  {
    before: "Fees collected over the counter and reconciled by hand",
    after:
      "Monthly invoices, numbered receipts and a dues list that updates itself",
  },
  {
    before: "Results tabulated in Excel, with GPA errors and late report cards",
    after:
      "Marks become GPA as they are typed, and report cards print by section",
  },
  {
    before: "Guardians hear about an absence days later, if at all",
    after: "Guardians see the absence in the portal the same morning",
  },
  {
    before: "Notices scattered across SMS, Facebook groups and paper",
    after: "One notice reaches the right class in the portal and by email",
  },
  {
    before: "Records on one office PC, open only from that desk",
    after:
      "Stored online and open from any phone, by the people allowed to see them",
  },
]

export function WhySwitch() {
  return (
    <Section>
      <Container className="flex flex-col gap-12">
        <SectionIntro
          eyebrow="Why schools switch"
          title="Registers and spreadsheets cost more than they seem"
        >
          Most of a school office&apos;s week goes on copying, adding up and
          chasing. That work is what {BRAND.name} takes over.
        </SectionIntro>
        <Card className="grid gap-0 py-0 md:grid-cols-2">
          <div>
            <p className="border-b px-6 py-4 text-sm font-semibold">Today</p>
            <ul>
              {ROWS.map((row) => (
                <li
                  key={row.before}
                  className="flex gap-3 border-b px-6 py-4 text-sm text-muted-foreground last:border-b-0"
                >
                  <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                  {row.before}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t bg-secondary/60 md:border-t-0 md:border-l">
            <p className="border-b px-6 py-4 text-sm font-semibold">
              With {BRAND.name}
            </p>
            <ul>
              {ROWS.map((row) => (
                <li
                  key={row.after}
                  className="flex gap-3 border-b px-6 py-4 text-sm font-medium last:border-b-0"
                >
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {row.after}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </Container>
    </Section>
  )
}
