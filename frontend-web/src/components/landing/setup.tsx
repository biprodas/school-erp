import { Globe, History, KeyRound, Lock, ReceiptText, ShieldCheck } from "lucide-react";
import { SITE } from "~/config/site";
import { Section, SectionHeading } from "../ui/section";

const STEPS = [
  {
    title: "Sign up",
    text: `Your school's name, your email and an address like shapla.${SITE.rootDomain}. No sales call.`,
  },
  {
    title: "Set up your year",
    text: "Session, shifts, classes, sections, subjects and your grading scale, guided step by step.",
  },
  {
    title: "Import students",
    text: "Upload the Excel list you already keep instead of typing everyone in again.",
  },
  {
    title: "Take attendance",
    text: "Invite teachers by email. They can mark their first roll call the same day.",
  },
];

const SCHOOLS = [
  { slug: "shapla", name: "Shapla Model School" },
  { slug: "greenfield", name: "Greenfield International" },
  { slug: "nobodoy", name: "Nobodoy Girls' High School" },
];

const SAFEGUARDS = [
  {
    icon: Lock,
    title: "Each school kept apart",
    text: "Checked by the application and again by the database. No school can see another's data.",
  },
  {
    icon: KeyRound,
    title: "Access by role",
    text: "Teachers see their classes, accountants see fees, guardians see only their own children.",
  },
  {
    icon: History,
    title: "Every change on record",
    text: "Edited marks, fee adjustments and permission changes keep the old value, who changed it and when.",
  },
  {
    icon: ReceiptText,
    title: "Receipts never rewritten",
    text: "Numbered in order with no gaps. A cancelled receipt needs a reason and stays visible.",
  },
];

export function Setup() {
  return (
    <Section labelledBy="setup-title">
      <SectionHeading id="setup-title" eyebrow="Self-serve setup" title="From sign-up to first roll call in a day" align="center">
        Skip any step and come back to it later. Your school is ready to use as soon as you sign
        up.
      </SectionHeading>

      <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t-2 border-line-strong pt-5">
            <span className="display text-[2.4rem] text-forest-2">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{s.text}</p>
          </li>
        ))}
      </ol>

      {/* Multi-tenant workspaces */}
      <div className="mt-24 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h3 id="workspaces" className="display text-[2.3rem] text-balance sm:text-[2.8rem]">
            Every school gets a workspace of its own
          </h3>
          <p className="mt-5 text-lg leading-relaxed text-ink-2">
            Kampasy serves many schools from one platform, but each works as if it had its own
            software: its own address, its own data, and its own classes, grading, fee heads and
            roles. Standard and Premium schools can use their own domain, like
            erp.yourschool.edu.bd.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            A teacher who works at two schools, or a guardian with children at different schools,
            keeps one login and sees each school separately.
          </p>
        </div>
        <ul aria-label="Example school addresses" className="space-y-3">
          {SCHOOLS.map((s, i) => (
            <li
              key={s.slug}
              className={`flex items-center gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line ${i === 1 ? "lg:ml-10" : i === 2 ? "lg:ml-20" : ""}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-forest-2">
                <Globe className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-sm text-ink-2">
                  <span className="font-medium text-ink">{s.slug}</span>.{SITE.rootDomain}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trust and security */}
      <div className="mt-24 grid gap-12 rounded-[1.75rem] bg-forest p-8 text-white sm:p-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:p-14">
        <div>
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-marigold">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <h3 className="display mt-7 text-[2.3rem] text-balance sm:text-[2.8rem]">
            Your school&apos;s records stay your school&apos;s
          </h3>
          <p className="mt-5 text-lg leading-relaxed text-white/75">
            Fees and results are what guardians question most. Neither can change without anyone
            knowing.
          </p>
        </div>
        <ul className="grid gap-8 sm:grid-cols-2">
          {SAFEGUARDS.map((s) => (
            <li key={s.title}>
              <s.icon className="size-5 text-marigold" aria-hidden="true" />
              <h4 className="mt-3 font-semibold">{s.title}</h4>
              <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{s.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
