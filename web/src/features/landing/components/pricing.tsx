import { Check, Plus } from "lucide-react";
import { APP_LINKS } from "~/config/site";
import {
  ADD_ONS,
  BILLING_FACTS,
  PRICING_PLANS,
  type PricingPlan,
} from "../content";
import { Container, SectionTitle, pill } from "./primitives";
import { cn } from "~/lib/utils";

const PLAN_HREF: Record<PricingPlan["href"], string> = {
  signup: APP_LINKS.signup,
  contact: "#contact",
};

export function Pricing() {
  return (
    <section
      id="pricing"
      className="border-border scroll-mt-16 border-y bg-white py-20 sm:py-28"
    >
      <Container className="max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-end">
          <div>
            <SectionTitle className="text-ink max-w-md">
              Pay only for the students you teach.
            </SectionTitle>
            <p className="text-ink-muted mt-5 max-w-md text-lg leading-relaxed">
              One price per active student, with a small monthly minimum. Every
              plan works in Bangla and English.
            </p>
          </div>
          <dl className="border-border grid grid-cols-3 border-t">
            {BILLING_FACTS.map((fact, i) => (
              <div
                key={fact.value}
                className={cn(
                  "flex flex-col-reverse pt-5",
                  i > 0 && "border-border border-s ps-4 sm:ps-6",
                )}
              >
                <dt className="text-ink-muted mt-1 text-xs leading-snug sm:text-sm">
                  {fact.label}
                </dt>
                <dd className="font-heading text-ink text-lg font-bold tracking-tight sm:text-2xl">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* gap-px over a tinted background draws the dividers between plans */}
        <ul className="border-border bg-border mt-14 grid gap-px overflow-hidden rounded-3xl border sm:grid-cols-2 lg:grid-cols-4 lg:overflow-visible">
          {PRICING_PLANS.map((plan) => (
            <PlanColumn key={plan.name} plan={plan} />
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-ink shrink-0 text-sm font-semibold">
            Add to a lower plan
          </p>
          <ul className="flex flex-wrap gap-2">
            {ADD_ONS.map((addOn) => (
              <li
                key={addOn}
                className="border-border bg-cream text-ink/80 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
              >
                <Plus className="text-brand size-3.5" strokeWidth={2.5} />
                {addOn}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function PlanColumn({ plan }: { plan: PricingPlan }) {
  const featured = plan.featured ?? false;
  return (
    <li
      className={cn(
        "relative flex flex-col p-7",
        featured
          ? "bg-brand text-white lg:-my-4 lg:rounded-3xl lg:py-11 lg:shadow-[0_30px_60px_-30px_oklch(0.25_0.06_160/0.7)]"
          : "text-ink bg-white lg:first:rounded-s-[calc(1.5rem-1px)] lg:last:rounded-e-[calc(1.5rem-1px)]",
      )}
    >
      {featured && (
        <span className="bg-highlight text-ink mb-4 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold">
          Your trial runs on this plan
        </span>
      )}
      <h3 className="font-heading text-2xl font-bold tracking-tight">
        {plan.name}
      </h3>
      <p
        className={cn(
          "mt-1 text-sm",
          featured ? "text-white/70" : "text-ink-muted",
        )}
      >
        {plan.audience}
      </p>

      <p className="mt-6">
        <span
          className={cn(
            "font-heading block font-bold tracking-tight",
            plan.price.startsWith("৳") ? "text-4xl" : "text-xl",
          )}
        >
          {plan.price}
        </span>
        {plan.period && (
          <span
            className={cn(
              "text-sm",
              featured ? "text-white/70" : "text-ink-muted",
            )}
          >
            {plan.period}
          </span>
        )}
      </p>

      <a
        href={PLAN_HREF[plan.href]}
        className={cn("mt-6 w-full", featured ? pill.highlight : pill.outline)}
      >
        {plan.cta}
      </a>

      <div
        className={cn(
          "mt-7 border-t pt-6",
          featured ? "border-white/20" : "border-border",
        )}
      >
        {plan.inherits && (
          <p
            className={cn(
              "mb-3 text-xs font-semibold",
              featured ? "text-white/70" : "text-ink-muted",
            )}
          >
            {plan.inherits}
          </p>
        )}
        <ul className="space-y-2.5 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  featured ? "text-highlight" : "text-brand",
                )}
                strokeWidth={2.5}
              />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
