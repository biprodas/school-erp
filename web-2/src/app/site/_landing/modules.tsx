import {
  BarChart3Icon,
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  GraduationCapIcon,
  IdCardIcon,
  LibraryIcon,
  LineChartIcon,
  MegaphoneIcon,
  MessageSquareTextIcon,
  SmartphoneIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { Container, Section, SectionIntro } from "./section"

const MODULES = [
  {
    icon: UsersIcon,
    title: "Students and guardians",
    body: "Profiles, guardians, documents and enrolment, imported from your existing Excel list.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Attendance",
    body: "Marked on a phone in under a minute, with holidays and student leave in the same place.",
  },
  {
    icon: GraduationCapIcon,
    title: "Exams and results",
    body: "GPA 5.0 and other scales, mark entry, tabulation, merit positions and report cards.",
  },
  {
    icon: WalletIcon,
    title: "Fees and receipts",
    body: "Fee heads, discounts, monthly invoices, counter collection, numbered receipts and dues.",
  },
  {
    icon: SmartphoneIcon,
    title: "Guardian portal",
    body: "Guardians and students see attendance, results, dues and notices on the web.",
  },
  {
    icon: MegaphoneIcon,
    title: "Notices",
    body: "Notices to the whole school, a class or a section, in the portal and by email.",
  },
  {
    icon: IdCardIcon,
    title: "Staff directory",
    body: "Teachers and staff with departments and designations, and the classes they teach.",
  },
  {
    icon: BarChart3Icon,
    title: "Reports",
    body: "Attendance registers, result sheets, and collection and dues reports, ready to print.",
  },
]

const COMING_SOON = [
  { icon: CreditCardIcon, label: "Online payments" },
  { icon: MessageSquareTextIcon, label: "SMS alerts" },
  { icon: BookOpenIcon, label: "Homework and LMS" },
  { icon: BriefcaseIcon, label: "HR and payroll" },
  { icon: LibraryIcon, label: "Library" },
  { icon: BusIcon, label: "Transport" },
  { icon: LineChartIcon, label: "Advanced analytics" },
]

export function Modules() {
  return (
    <Section id="modules">
      <Container className="flex flex-col gap-12">
        <SectionIntro
          eyebrow="Modules"
          title="Everything the school runs on, already connected"
        >
          A payment updates the dues list, an absence reaches the guardian, a
          published result lands in the portal. No re-typing between systems.
        </SectionIntro>
        <div className="flex flex-col gap-4">
          <ul className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="group/module flex flex-col gap-3 bg-card p-6 transition-colors duration-200 hover:bg-secondary/50"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-colors duration-200 group-hover/module:bg-primary/50 group-hover/module:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-secondary/40 p-4 sm:flex-row sm:items-center">
            <div className="shrink-0 text-sm">
              <p className="font-semibold">Coming soon</p>
              <p className="text-muted-foreground">Not available yet</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {COMING_SOON.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Badge variant="outline" className="h-7 bg-card px-3">
                    <Icon />
                    {label}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  )
}
