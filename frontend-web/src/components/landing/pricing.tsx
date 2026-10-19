import { Check } from "lucide-react";
import { LINKS } from "~/config/site";
import { ButtonLink } from "../ui/button-link";
import { Section, SectionHeading } from "../ui/section";

type Plan = {
  name: string;
  forWho: string;
  price: string;
  priceNote: string;
  intro: string;
  items: string[];
  cta: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    forWho: "Up to 100 students",
    price: "৳0",
    priceNote: "free, with no time limit",
    intro: "To try it, or for a very small school",
    items: ["Students and staff directory", "Daily attendance", "Notices and email", "Exams and results"],
    cta: "Start free",
  },
  {
    name: "Basic",
    forWho: "Small schools",
    price: "৳20",
    priceNote: "per student a month",
    intro: "Everything in Free, plus",
    items: [
      "Fees, receipts and dues",
      "bKash and card payments",
      "Report cards and guardian portal",
      "SMS alerts (prepaid credits)",
    ],
    cta: "Start free trial",
  },
  {
    name: "Standard",
    forWho: "Mid-size schools",
    price: "৳35",
    priceNote: "per student a month",
    intro: "Everything in Basic, plus",
    items: ["Custom roles", "Your own domain", "Homework, timetable and payroll as they arrive"],
    cta: "Start 30-day free trial",
    featured: true,
  },
  {
    name: "Premium",
    forWho: "Large schools",
    price: "৳55",
    priceNote: "per student a month",
    intro: "Everything in Standard, plus",
    items: [
      "Two-factor sign-in for admins and accountants",
      "Priority support",
      "Transport, multi-branch and analytics as they arrive",
    ],
    cta: "Start free trial",
  },
];

export function Pricing() {
  return (
    <Section id="pricing" labelledBy="pricing-title" tone="paper">
      <SectionHeading id="pricing-title" eyebrow="Pricing" title="Pay only for the students you have" align="center">
        One price per active student each month. Pay for the year and get two months free. Every
        school starts with 30 days of Standard, no card needed.
      </SectionHeading>

      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
        {PLANS.map((plan) => {
          const dark = plan.featured;
          const muted = dark ? "text-white/70" : "text-ink-3";
          return (
            <li
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-6 ${
                dark
                  ? "bg-forest text-white shadow-[0_32px_48px_-28px_rgba(20,63,48,0.75)] lg:-my-3 lg:pt-9 lg:pb-9"
                  : "bg-paper ring-1 ring-line"
              }`}
            >
              {dark ? (
                <span className="absolute -top-3 left-6 rounded-full bg-marigold px-3 py-1 text-xs font-semibold text-ink">
                  Included in your free trial
                </span>
              ) : null}

              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className={`mt-0.5 text-sm ${muted}`}>{plan.forWho}</p>

              <p className="display mt-7 text-[2.75rem] leading-none">{plan.price}</p>
              <p className={`mt-2 text-sm ${muted}`}>{plan.priceNote}</p>

              <p className="mt-6 text-sm font-semibold">{plan.intro}</p>
              <ul className="mt-3 flex-1 space-y-2">
                {plan.items.map((item) => (
                  <li key={item} className={`flex items-start gap-2.5 text-[15px] ${dark ? "" : "text-ink-2"}`}>
                    <Check
                      className={`mt-1 size-4 shrink-0 ${dark ? "text-marigold" : "text-forest-2"}`}
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={LINKS.signup}
                variant={dark ? "highlight" : "outline"}
                className="mt-8 w-full"
              >
                {plan.cta}
              </ButtonLink>
            </li>
          );
        })}
      </ul>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-ink-3">
        Prices are in taka, with a small monthly minimum. SMS credits are prepaid. Add-ons for
        transport, hostel and homework can be bought on any plan once they launch.
      </p>
    </Section>
  );
}
