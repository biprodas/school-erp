import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { APP_LINKS } from "~/config/site";
import { HERO_POINTS } from "../content";
import { Container, pill } from "./primitives";

const GRID_BACKGROUND = {
  backgroundImage:
    "linear-gradient(to right, oklch(0.19 0.035 260 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.19 0.035 260 / 0.05) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
};

export function Hero() {
  return (
    <section className="bg-cream" style={GRID_BACKGROUND}>
      <Container className="grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        <div>
          <p className="border-border text-ink/80 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs">
            <span className="bg-brand-strong size-1.5 rounded-full" />
            Built for schools in Bangladesh
          </p>
          <h1 className="text-ink mt-6 text-5xl leading-[0.98] font-bold tracking-tight text-balance sm:text-6xl">
            Run your entire school from{" "}
            <span className="text-brand">one calm dashboard.</span>
          </h1>
          <p className="text-ink-muted mt-6 max-w-lg text-lg leading-relaxed text-pretty">
            Admissions, attendance, exams, fees and notices on one mobile-first
            platform. Teachers mark attendance from a phone, guardians pay by
            bKash, and results go out in days, not weeks.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={APP_LINKS.signup} className={pill.primary}>
              Start free trial <ArrowRight className="size-4" />
            </a>
            <Link href="/find-school" className={pill.outline}>
              Sign in to your school
            </Link>
          </div>
          <ul className="text-ink-muted mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {HERO_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Check className="text-brand size-4" strokeWidth={3} />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <DashboardPreview />
      </Container>
    </section>
  );
}

const SIDEBAR_ITEMS = [
  "Overview",
  "Students",
  "Attendance",
  "Fees",
  "Exams",
  "Timetable",
  "Messages",
];

const KPIS = [
  { label: "Students", value: "2,418" },
  { label: "Present today", value: "96.4%" },
  { label: "Fees due", value: "৳4.2L" },
];

const WEEKLY_ATTENDANCE = [62, 78, 70, 86, 92, 80, 88];

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:ms-auto" aria-hidden>
      <div className="border-border overflow-hidden rounded-2xl border bg-white shadow-[0_24px_60px_-24px_oklch(0.19_0.035_260/0.25)]">
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <span className="bg-ink/10 size-2.5 rounded-full" />
          <span className="bg-ink/10 size-2.5 rounded-full" />
          <span className="bg-ink/10 size-2.5 rounded-full" />
          <span className="text-ink-muted ms-4 truncate text-xs">
            greenfield.kampasy.app/dashboard
          </span>
        </div>
        <div className="flex">
          <ul className="bg-cream text-ink/75 hidden w-32 shrink-0 space-y-1 p-3 text-xs sm:block">
            {SIDEBAR_ITEMS.map((item, i) => (
              <li
                key={item}
                className={
                  i === 0
                    ? "bg-brand-soft text-brand rounded-md px-2 py-1.5 font-semibold"
                    : "px-2 py-1.5"
                }
              >
                {item}
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1 space-y-3 p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-3">
              {KPIS.map((kpi) => (
                <div
                  key={kpi.label}
                  className="border-border rounded-xl border p-3"
                >
                  <p className="text-ink-muted truncate text-[11px]">
                    {kpi.label}
                  </p>
                  <p className="font-heading text-ink mt-1 text-base font-bold sm:text-lg">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-border rounded-xl border p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink font-semibold">
                  Weekly attendance
                </span>
                <span className="text-brand-strong">+3.1%</span>
              </div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {WEEKLY_ATTENDANCE.map((height, i) => (
                  <div
                    key={i}
                    className="bg-brand-strong flex-1"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
            <ActivityRow
              label="Ayesha R. · Class 7B · bKash"
              badge="Fee paid"
              tone="success"
            />
            <ActivityRow
              label="Term 1 exam results"
              badge="Published"
              tone="neutral"
            />
          </div>
        </div>
      </div>
      <div className="border-border absolute start-0 -bottom-6 rounded-xl border bg-white px-4 py-3 shadow-lg sm:-start-6 lg:-start-8">
        <p className="text-ink-muted text-[11px]">Guardian alert · 8:05 AM</p>
        <p className="text-ink mt-0.5 flex items-center gap-1 text-sm font-semibold">
          <Check className="text-brand size-4" /> Rafi is present today
        </p>
      </div>
    </div>
  );
}

function ActivityRow({
  label,
  badge,
  tone,
}: {
  label: string;
  badge: string;
  tone: "success" | "neutral";
}) {
  return (
    <div className="border-border flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs">
      <span className="text-ink truncate">{label}</span>
      <span
        className={
          tone === "success"
            ? "bg-brand-soft text-brand shrink-0 rounded-full px-2 py-0.5 font-semibold"
            : "bg-cream text-ink/80 shrink-0 rounded-full px-2 py-0.5 font-semibold"
        }
      >
        {badge}
      </span>
    </div>
  );
}
