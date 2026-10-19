import { KEY_METRICS } from "../content";
import { Container } from "./primitives";
import { cn } from "~/lib/utils";

export function KeyMetrics() {
  return (
    <section
      aria-label="Kampasy in numbers"
      className="border-border border-y bg-white py-10 sm:py-12"
    >
      <Container className="max-w-6xl">
        <dl className="grid grid-cols-2 gap-y-8 lg:grid-cols-4">
          {KEY_METRICS.map((metric, i) => (
            <div
              key={metric.label}
              className={cn(
                "border-border flex flex-col-reverse justify-end px-4 sm:px-8",
                // Hairline separators: between the two columns on small
                // screens, between every column once all four share a row.
                i % 2 === 1 && "border-s",
                i === 2 && "lg:border-s",
              )}
            >
              <dt className="text-ink-muted mt-2 max-w-[16rem] text-sm leading-relaxed">
                {metric.label}
              </dt>
              <dd className="font-heading text-brand text-3xl font-bold tracking-tight sm:text-4xl">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
