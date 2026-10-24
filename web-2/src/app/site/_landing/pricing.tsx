import { CheckIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { cn } from "~/lib/utils"
import { SIGNUP_HREF } from "./links"
import { Container, Section, SectionIntro } from "./section"

const PLANS = [
  {
    name: "Free",
    audience: "Up to 100 students",
    price: "৳0",
    unit: "free, with no time limit",
    includesLabel: "To try it, or for a very small school",
    features: [
      "Students and staff directory",
      "Daily attendance",
      "Notices and email",
      "Exams and results",
    ],
    cta: "Start free",
  },
  {
    name: "Basic",
    audience: "Small schools",
    price: "৳20",
    unit: "per student a month",
    includesLabel: "Everything in Free, plus",
    features: [
      "Fees, receipts and dues",
      "bKash and card payments",
      "Report cards and guardian portal",
      "SMS alerts (prepaid credits)",
    ],
    cta: "Start free trial",
  },
  {
    name: "Standard",
    audience: "Mid-size schools",
    price: "৳35",
    unit: "per student a month",
    includesLabel: "Everything in Basic, plus",
    features: [
      "Custom roles",
      "Your own domain",
      "Homework, timetable and payroll as they arrive",
    ],
    cta: "Start 30-day free trial",
    featured: true,
  },
  {
    name: "Premium",
    audience: "Large schools",
    price: "৳55",
    unit: "per student a month",
    includesLabel: "Everything in Standard, plus",
    features: [
      "Two-factor sign-in for admins and accountants",
      "Priority support",
      "Transport, multi-branch and analytics as they arrive",
    ],
    cta: "Start free trial",
  },
]

export function Pricing() {
  return (
    <Section id="pricing" className="bg-card">
      <Container className="flex flex-col gap-14">
        <SectionIntro
          eyebrow="Pricing"
          title="Pay only for the students you have"
          align="center"
        >
          One price per active student each month. Pay for the year and get two
          months free. Every school starts with 30 days of Standard, no card
          needed.
        </SectionIntro>
        <div className="grid gap-px overflow-hidden rounded-2xl bg-border shadow-sm ring-1 ring-border sm:grid-cols-2 lg:grid-cols-4 lg:overflow-visible">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col gap-6 bg-background p-6 lg:first:rounded-l-2xl lg:last:rounded-r-2xl",
                plan.featured &&
                  "relative bg-brand text-brand-foreground lg:-my-5 lg:rounded-2xl lg:py-11 lg:shadow-xl"
              )}
            >
              <div className="flex min-h-12 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {plan.featured && (
                    <Badge className="bg-highlight text-highlight-foreground">
                      Free for 30 days
                    </Badge>
                  )}
                </div>
                <p
                  className={cn(
                    "text-sm text-muted-foreground",
                    plan.featured && "text-brand-foreground/70"
                  )}
                >
                  {plan.audience}
                </p>
              </div>
              <div>
                <p className="font-display text-5xl">{plan.price}</p>
                <p
                  className={cn(
                    "mt-2 text-sm text-muted-foreground",
                    plan.featured && "text-brand-foreground/70"
                  )}
                >
                  {plan.unit}
                </p>
              </div>
              <a
                href={SIGNUP_HREF}
                className={cn(
                  buttonVariants({
                    variant: plan.featured ? "default" : "outline",
                    size: "lg",
                  }),
                  "h-10 w-full rounded-full",
                  plan.featured &&
                    "bg-highlight text-highlight-foreground hover:bg-highlight/85"
                )}
              >
                {plan.cta}
              </a>
              <Separator
                className={cn(plan.featured && "bg-brand-foreground/15")}
              />
              <div className="flex flex-col gap-3 text-sm">
                <p className="font-semibold">{plan.includesLabel}</p>
                <ul className="flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <CheckIcon
                        className={cn(
                          "mt-0.5 size-4 shrink-0 text-primary",
                          plan.featured && "text-highlight"
                        )}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
          Prices are in taka, with a small monthly minimum. SMS credits are
          prepaid. Add-ons for transport, hostel and homework can be bought on
          any plan once they launch.
        </p>
      </Container>
    </Section>
  )
}
