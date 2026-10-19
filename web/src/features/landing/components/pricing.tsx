import { PRICING_PLANS, type PricingPlan } from "../content";
import { Container, Eyebrow, SectionTitle, pill } from "./primitives";
import { cn } from "~/lib/utils";

export function Pricing() {
  return (
    <section id="pricing" className="bg-cream scroll-mt-16 py-20 sm:py-28">
      <Container>
        <div className="text-center">
          <Eyebrow>Pricing</Eyebrow>
          <SectionTitle className="text-ink mx-auto mt-3 max-w-xl">
            Simple pricing that grows with you.
          </SectionTitle>
          <p className="text-ink-muted mt-5 text-lg">
            Billed monthly per school. No setup fees on annual plans.
          </p>
        </div>
        <ul className="mt-14 grid items-stretch gap-6 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </ul>
      </Container>
    </section>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const featured = plan.featured ?? false;
  return (
    <li
      className={cn(
        "flex flex-col rounded-2xl border p-8",
        featured
          ? "border-brand/60 bg-ink text-white shadow-[0_30px_60px_-30px_oklch(0.19_0.035_260/0.6)]"
          : "border-border text-ink bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-sans text-lg font-bold">{plan.name}</h3>
        {featured && (
          <span className="bg-highlight text-ink rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Most popular
          </span>
        )}
      </div>
      <p className="mt-6 flex items-baseline">
        <span className="font-heading text-5xl font-bold tracking-tight">
          {plan.price}
        </span>
        {plan.period && (
          <span
            className={cn(
              "ms-0.5 text-sm",
              featured ? "text-white/70" : "text-ink-muted",
            )}
          >
            {plan.period}
          </span>
        )}
      </p>
      <p
        className={cn(
          "mt-1 text-sm",
          featured ? "text-white/60" : "text-ink-muted",
        )}
      >
        {plan.audience}
      </p>
      <ul className="mt-8 mb-10 space-y-2.5 text-sm">
        {plan.features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>
      <a
        href="#demo"
        className={cn("mt-auto w-full", featured ? pill.primary : pill.outline)}
      >
        {plan.cta}
      </a>
    </li>
  );
}
