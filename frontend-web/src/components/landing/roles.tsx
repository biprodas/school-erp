"use client";

import { Check } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Role = {
  id: string;
  label: string;
  title: string;
  points: string[];
  view: ReactNode;
};

const ROLES: Role[] = [
  {
    id: "owners",
    label: "Owners",
    title: "The whole school's numbers, on your phone",
    points: [
      "Today's attendance, collection and dues the moment you sign in",
      "Fee collection by month, and the exams coming up",
      "Every payment, admission and published notice as it happens",
    ],
    view: <OwnerDashboard />,
  },
  {
    id: "principals",
    label: "Principals",
    title: "Know which classes need you before assembly",
    points: [
      "Sections that haven't submitted attendance yet",
      "Marks waiting for your approval before results go out",
      "Only you can reopen approved marks, and the change is recorded",
    ],
    view: (
      <Card title="Today, 8:30" aside="Shapla Model School">
        <p className="text-sm font-semibold">Attendance not submitted</p>
        <ul className="mt-2 space-y-1.5">
          {["Class 3 B", "Class 7 A", "Class 9 C", "Class 10 B"].map((c) => (
            <li key={c} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
              {c}
              <span className="text-xs text-ink-3">Waiting</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-lg bg-marigold-tint px-3 py-2.5 text-sm">
          Class 9 half-yearly marks are ready for your approval.
        </div>
      </Card>
    ),
  },
  {
    id: "teachers",
    label: "Teachers",
    title: "Attendance and marks from the phone in your pocket",
    points: [
      "Everyone starts present: tap the few who aren't, then save",
      "Enter marks in a grid that works with a keyboard or a touchscreen",
      "See your classes, subjects and the notices meant for staff",
    ],
    view: (
      <Card title="My classes today" aside="Rafiq Karim">
        <ul className="divide-y divide-line">
          {[
            ["Class 6 A, Mathematics", "Attendance saved", "text-forest-2"],
            ["Class 7 B, Mathematics", "Take attendance", "text-ink"],
            ["Class 9 C, Higher Math", "Marks: 31 of 42 entered", "text-ink-2"],
          ].map(([cls, state, tone]) => (
            <li key={cls} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="font-medium">{cls}</span>
              <span className={`text-right ${tone}`}>{state}</span>
            </li>
          ))}
        </ul>
      </Card>
    ),
  },
  {
    id: "accountants",
    label: "Accountants",
    title: "Collect at the counter and close the day without a calculator",
    points: [
      "Find a student, take payment and print a numbered receipt",
      "Sibling and scholarship discounts applied automatically",
      "Dues by class and month, and a daily report that matches the drawer",
    ],
    view: (
      <Card title="Dues, Class 8" aside="October">
        <ul className="divide-y divide-line">
          {[
            ["Nusrat Jahan, 8 B", "৳2,400", "1 month"],
            ["Sabbir Hossain, 8 A", "৳4,800", "2 months"],
            ["Tasnim Ara, 8 C", "৳2,400", "1 month"],
            ["Riyad Hasan, 8 A", "৳7,200", "3 months"],
          ].map(([name, amount, months]) => (
            <li key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="block font-medium">{name}</span>
                <span className="text-xs text-ink-3">{months}</span>
              </span>
              <span className="font-semibold text-red tabular-nums">{amount}</span>
            </li>
          ))}
        </ul>
      </Card>
    ),
  },
  {
    id: "students",
    label: "Students",
    title: "Results, attendance and notices in one place",
    points: [
      "Published results with each subject's grade, and the report card",
      "Your own attendance for the month",
      "Class notices without waiting for a printed slip",
    ],
    view: (
      <Card title="Half-yearly exam 2026" aside="Tahmid, Class 9">
        {[
          ["Bangla", "A", "4.00"],
          ["English", "A+", "5.00"],
          ["Mathematics", "A+", "5.00"],
          ["Physics", "A", "4.00"],
        ].map(([subject, grade, point]) => (
          <div key={subject} className="flex justify-between border-b border-line py-2 text-sm">
            <span>{subject}</span>
            <span className="tabular-nums">
              <span className="mr-4 font-semibold">{grade}</span>
              {point}
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between pt-3">
          <span className="text-sm font-semibold">GPA</span>
          <span className="display text-3xl text-forest-2">4.79</span>
        </div>
      </Card>
    ),
  },
  {
    id: "guardians",
    label: "Guardians",
    title: "Your children's day, without calling the office",
    points: [
      "Whether each child was marked present today",
      "Fee dues, receipts and results as soon as they're published",
      "One login for all your children, even at different schools",
    ],
    view: (
      <Card title="Nusrat, Class 8 B" aside="Shapla Model School">
        <div className="mb-3 flex gap-2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Nusrat</span>
          <span className="rounded-full px-3 py-1 text-xs text-ink-2 ring-1 ring-line">Tanvir</span>
        </div>
        <Line label="Today" value="Present" tone="text-forest-2" />
        <Line label="October attendance" value="21 of 22 days" />
        <Line label="Due" value="৳0, paid 19 Oct" />
        <p className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-sm">
          Notice: Half-yearly exam routine published
        </p>
      </Card>
    ),
  },
];

export function Roles() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const role = ROLES[active];

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = ROLES.length - 1;
    const next =
      e.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : e.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <>
      <div role="tablist" aria-label="Roles" className="mt-10 flex flex-wrap gap-2">
        {ROLES.map((r, i) => (
          <button
            key={r.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={`role-tab-${r.id}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`role-panel-${r.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={onKeyDown}
            className={`rounded-full px-4 py-2 text-[15px] font-semibold transition-colors ${
              i === active
                ? "bg-marigold text-ink"
                : "text-white/85 ring-1 ring-inset ring-white/25 hover:bg-white/10"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div
        key={role.id}
        id={`role-panel-${role.id}`}
        role="tabpanel"
        aria-labelledby={`role-tab-${role.id}`}
        className="mt-12 grid animate-fade items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16"
      >
        <div>
          <h3 className="text-[1.75rem] leading-tight font-semibold text-balance sm:text-[2rem]">{role.title}</h3>
          <ul className="mt-6 space-y-3.5">
            {role.points.map((p) => (
              <li key={p} className="flex gap-3 text-[17px] text-white/85">
                <Check className="mt-1 size-4 shrink-0 text-marigold" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden="true">{role.view}</div>
      </div>
    </>
  );
}

function Card({ title, aside, children }: { title: string; aside: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-paper text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <p className="font-semibold">{title}</p>
        <p className="truncate text-sm text-ink-3">{aside}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Line({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between border-b border-line py-2 text-sm">
      <span className="text-ink-2">{label}</span>
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}

const MONTHS = [
  { m: "May", v: 62 },
  { m: "Jun", v: 74 },
  { m: "Jul", v: 58 },
  { m: "Aug", v: 77 },
  { m: "Sep", v: 84 },
  { m: "Oct", v: 92 },
];

/** The owner's home screen: the product overview in one card. */
function OwnerDashboard() {
  return (
    <Card title="Good afternoon" aside="Shapla Model School">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Present today" value="94.2%" note="1,268 of 1,346" />
        <Stat label="Collected today" value="৳2.53L" note="2 counters" />
        <Stat label="Still due" value="৳3.1L" note="214 students" warn />
      </div>

      <p className="mt-5 text-xs text-ink-3">Fee collection, last 6 months</p>
      <div className="mt-2 flex h-24 items-end gap-2">
        {MONTHS.map((x, i) => (
          <div key={x.m} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`w-full rounded-t-md ${i === MONTHS.length - 1 ? "bg-forest-2" : "bg-mint-2"}`}
              style={{ height: `${Math.round(x.v * 0.75)}px` }}
            />
            <span className="text-[11px] text-ink-3">{x.m}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-ink-2">Upcoming exams</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex justify-between gap-2">
              <span>Class test, Math 8</span>
              <span className="text-ink-3">24 Oct</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Half-yearly, 6 to 10</span>
              <span className="text-ink-3">9 Nov</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-2">Recent activity</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-forest-2" />
              Receipt 004817, ৳4,020
            </li>
            <li className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-marigold" />
              Notice: exam routine
            </li>
            <li className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
              New admission, Class 6 C
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, note, warn = false }: { label: string; value: string; note: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-canvas p-3">
      <p className="text-[11px] text-ink-3 sm:text-xs">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${warn ? "text-red" : ""}`}>{value}</p>
      <p className="text-[11px] text-ink-3">{note}</p>
    </div>
  );
}
