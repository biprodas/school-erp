import { SCHOOL_DAY } from "../content";
import { Container, SectionTitle } from "./primitives";
import { cn } from "~/lib/utils";

type Artifact = (typeof SCHOOL_DAY.moments)[number]["artifact"];

/** Shades for the collection bar, one per channel, darkest first. */
const CHANNEL_SHADES = ["bg-brand", "bg-brand/55", "bg-brand/25"];

export function SchoolDay() {
  return (
    <section
      id="school-day"
      className="border-border scroll-mt-16 border-t bg-white py-20 sm:py-28"
    >
      <Container className="max-w-6xl">
        <SectionTitle className="text-ink">
          A Monday at {SCHOOL_DAY.school}
        </SectionTitle>
        <p className="text-ink-muted mt-4 text-lg">
          Five moments from one school day, and who they save time for.
        </p>

        <ol className="border-ink/15 mt-12 border-t">
          {SCHOOL_DAY.moments.map((moment) => (
            <li
              key={moment.time}
              className="border-ink/10 grid gap-x-10 gap-y-5 border-b py-10 md:grid-cols-[8rem_1fr] lg:grid-cols-[9rem_1fr_17rem]"
            >
              <div>
                <time className="font-heading text-ink block text-4xl leading-none font-bold tracking-tight sm:text-5xl">
                  {moment.time}
                </time>
                <p className="text-ink-muted mt-2 text-xs">{moment.role}</p>
              </div>

              <div>
                <h3 className="text-ink font-sans text-lg font-bold">
                  {moment.title}
                </h3>
                <p className="text-ink-muted mt-2 max-w-prose text-sm leading-relaxed">
                  {moment.description}
                </p>
              </div>

              <div className="md:col-start-2 lg:col-start-auto">
                <MomentArtifact artifact={moment.artifact} />
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/** What the person in that moment actually sees on screen or phone. */
function MomentArtifact({ artifact }: { artifact: Artifact }) {
  switch (artifact.kind) {
    case "note":
      return (
        <p className="text-ink-muted text-sm">
          <strong className="text-ink font-semibold">{artifact.strong}</strong>{" "}
          {artifact.text}
        </p>
      );

    case "list":
      return (
        <div className="text-sm">
          <p className="text-ink font-semibold">{artifact.heading}</p>
          <p className="text-ink-muted mt-1.5">{artifact.items.join(", ")}</p>
        </div>
      );

    case "sms":
      return (
        <figure>
          <figcaption className="text-ink-muted text-[11px] font-medium tracking-wide">
            {artifact.sender}
          </figcaption>
          <p
            lang="bn"
            className="bg-brand-soft text-ink mt-1.5 rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed"
          >
            {artifact.text}
          </p>
        </figure>
      );

    case "receipt":
      return (
        <div className="text-sm">
          <p className="text-ink font-semibold">{artifact.heading}</p>
          <dl className="mt-3 space-y-1.5">
            {artifact.lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{line.label}</dt>
                <dd className="text-ink tabular-nums">{line.amount}</dd>
              </div>
            ))}
            <div className="border-ink/15 mt-2 flex justify-between gap-4 border-t pt-2 font-semibold">
              <dt className="text-ink">{artifact.total.label}</dt>
              <dd className="text-ink tabular-nums">{artifact.total.amount}</dd>
            </div>
          </dl>
        </div>
      );

    case "collection":
      return (
        <div className="text-sm">
          <div className="flex justify-between gap-4 font-semibold">
            <span className="text-ink">{artifact.heading}</span>
            <span className="text-ink tabular-nums">{artifact.total}</span>
          </div>
          <div
            aria-hidden
            className="bg-ink/5 mt-3 flex h-2 overflow-hidden rounded-full"
          >
            {artifact.channels.map((channel, i) => (
              <span
                key={channel.label}
                className={CHANNEL_SHADES[i]}
                style={{ width: `${channel.share}%` }}
              />
            ))}
          </div>
          <dl className="mt-3 space-y-1.5">
            {artifact.channels.map((channel, i) => (
              <div key={channel.label} className="flex justify-between gap-4">
                <dt className="text-ink-muted flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-2 rounded-full", CHANNEL_SHADES[i])}
                  />
                  {channel.label}
                </dt>
                <dd className="text-ink tabular-nums">{channel.amount}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
  }
}
