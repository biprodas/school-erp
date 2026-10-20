import {
  GlobeIcon,
  HistoryIcon,
  KeyRoundIcon,
  LockIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { cn } from "~/lib/utils"
import { Container, DisplayHeading, Section, SectionIntro } from "./section"

const STEPS = [
  {
    title: "Sign up",
    body: "Your school's name, your email and an address like shapla.kampasy.com. No sales call.",
  },
  {
    title: "Set up your year",
    body: "Session, shifts, classes, sections, subjects and your grading scale, guided step by step.",
  },
  {
    title: "Import students",
    body: "Upload the Excel list you already keep instead of typing everyone in again.",
  },
  {
    title: "Take attendance",
    body: "Invite teachers by email. They can mark their first roll call the same day.",
  },
]

const SCHOOLS = [
  { name: "Shapla Model School", slug: "shapla" },
  { name: "Greenfield International", slug: "greenfield" },
  { name: "Nobodoy Girls' High School", slug: "nobodoy" },
]

const SAFEGUARDS = [
  {
    icon: LockIcon,
    title: "Each school kept apart",
    body: "Checked by the application and again by the database. No school can see another's data.",
  },
  {
    icon: KeyRoundIcon,
    title: "Access by role",
    body: "Teachers see their classes, accountants see fees, guardians see only their own children.",
  },
  {
    icon: HistoryIcon,
    title: "Every change on record",
    body: "Edited marks, fee adjustments and permission changes keep the old value, who changed it and when.",
  },
  {
    icon: ReceiptTextIcon,
    title: "Receipts never rewritten",
    body: "Numbered in order with no gaps. A cancelled receipt needs a reason and stays visible.",
  },
]

const INDENT = ["", "lg:ml-10", "lg:ml-20"]

export function Setup() {
  return (
    <Section>
      <Container className="flex flex-col gap-24">
        <div className="flex flex-col gap-12">
          <SectionIntro
            eyebrow="Self-serve setup"
            title="From sign-up to first roll call in a day"
            align="center"
            className="items-center"
          >
            Skip any step and come back to it later. Your school is ready to use
            as soon as you sign up.
          </SectionIntro>
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex flex-col gap-2 border-t-2 pt-5"
              >
                <span className="font-display text-4xl text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <DisplayHeading className="text-4xl sm:text-5xl">
              Every school gets a workspace of its own
            </DisplayHeading>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Kampasy serves many schools from one platform, but each works as
              if it had its own software: its own address, its own data, and its
              own classes, grading, fee heads and roles. Standard and Premium
              schools can use their own domain, like erp.yourschool.edu.bd.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              A teacher who works at two schools, or a guardian with children at
              different schools, keeps one login and sees each school
              separately.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {SCHOOLS.map((school, i) => (
              <li
                key={school.slug}
                className={cn(
                  "flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm",
                  INDENT[i]
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <GlobeIcon className="size-5" />
                </span>
                <div className="text-sm">
                  <p className="font-semibold">{school.name}</p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {school.slug}
                    </span>
                    .kampasy.com
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-10 rounded-3xl bg-brand p-8 text-brand-foreground sm:p-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-5">
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-foreground/10 text-highlight">
              <ShieldCheckIcon className="size-5" />
            </span>
            <DisplayHeading className="text-4xl sm:text-5xl">
              Your school&apos;s records stay your school&apos;s
            </DisplayHeading>
            <p className="text-lg leading-relaxed text-brand-foreground/75">
              Fees and results are what guardians question most. Neither can
              change without anyone knowing.
            </p>
          </div>
          <ul className="grid gap-8 sm:grid-cols-2">
            {SAFEGUARDS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex flex-col gap-2">
                <Icon className="size-5 text-highlight" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-brand-foreground/75">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  )
}
