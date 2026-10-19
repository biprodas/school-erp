const FIGURES = [
  { value: "< 24 h", label: "from sign-up to the first attendance taken" },
  { value: "≤ 3 days", label: "to publish results after the last exam" },
  { value: "360 px", label: "every core task works on a small phone" },
  { value: "100%", label: "of money and mark changes kept in the audit log" },
];

export function KeyFigures() {
  return (
    <section aria-label="Kampasy in numbers" className="border-t border-line bg-paper">
      <dl className="mx-auto grid max-w-6xl gap-y-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {FIGURES.map((f, i) => (
          <div
            key={f.value}
            className={`flex flex-col-reverse gap-1.5 lg:px-8 ${i === 0 ? "lg:pl-0" : "lg:border-l lg:border-line"}`}
          >
            <dt className="text-[15px] leading-snug text-ink-2">{f.label}</dt>
            <dd className="display text-[2.4rem] text-forest-2">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
