"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toBnDigits } from "~/lib/bangla";

type Lang = "en" | "bn";
type Status = "present" | "absent" | "late";

const NEXT: Record<Status, Status> = { present: "absent", absent: "late", late: "present" };

const STUDENTS = [
  { en: "Afsana Akter", bn: "আফসানা আক্তার", status: "present" },
  { en: "Arif Hossain", bn: "আরিফ হোসেন", status: "late" },
  { en: "Farhana Islam", bn: "ফারহানা ইসলাম", status: "late" },
  { en: "Imran Kabir", bn: "ইমরান কবির", status: "present" },
  { en: "Mehjabin Rahman", bn: "মেহজাবিন রহমান", status: "present" },
  { en: "Nafis Chowdhury", bn: "নাফিস চৌধুরী", status: "present" },
  { en: "Rafi Ahmed", bn: "রাফি আহমেদ", status: "absent" },
  { en: "Sadia Sultana", bn: "সাদিয়া সুলতানা", status: "present" },
] as const;

/** Rolls 9 to 42 are off-screen and all present. */
const HIDDEN_PRESENT = 34;

const T = {
  title: { en: "Class 6, Section A", bn: "ষষ্ঠ শ্রেণি, শাখা ক" },
  meta: { en: "Morning shift, Monday 19 October", bn: "প্রভাতি শিফট, সোমবার ১৯ অক্টোবর" },
  hint: {
    en: "Everyone starts present. Tap a name to mark them absent or late.",
    bn: "সবাই শুরুতে উপস্থিত। অনুপস্থিত বা দেরি চিহ্নিত করতে নামে চাপুন।",
  },
  rest: { en: "Rolls 9 to 42, all present", bn: "রোল ৯ থেকে ৪২, সবাই উপস্থিত" },
  save: { en: "Save attendance", bn: "উপস্থিতি সংরক্ষণ" },
  saved: { en: "Saved", bn: "সংরক্ষিত" },
  present: { en: "Present", bn: "উপস্থিত" },
  absent: { en: "Absent", bn: "অনুপস্থিত" },
  late: { en: "Late", bn: "দেরি" },
} as const;

const CHIP: Record<Status, string> = {
  present: "border-mint-2 bg-mint text-forest-2",
  absent: "border-red/25 bg-red-tint text-red",
  late: "border-dashed border-ink-3 bg-paper text-ink",
};

export function AttendanceRegister() {
  const [lang, setLang] = useState<Lang>("en");
  const [statuses, setStatuses] = useState<Status[]>(STUDENTS.map((s) => s.status));
  const [saved, setSaved] = useState(false);

  const n = (v: number | string) => (lang === "bn" ? toBnDigits(v) : String(v));
  const count = (s: Status) => statuses.filter((x) => x === s).length;
  const present = count("present") + HIDDEN_PRESENT;
  const summary =
    lang === "en"
      ? `${present} present, ${count("absent")} absent, ${count("late")} late`
      : `উপস্থিত ${n(present)}, অনুপস্থিত ${n(count("absent"))}, দেরি ${n(count("late"))}`;

  function toggle(i: number) {
    setSaved(false);
    setStatuses((prev) => prev.map((s, j) => (j === i ? NEXT[s] : s)));
  }

  return (
    <div className="overflow-hidden rounded-[1.4rem] bg-paper ring-1 ring-line shadow-[0_30px_60px_-30px_rgba(20,63,48,0.35)]">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4">
        <div lang={lang}>
          <p className="text-lg font-semibold">{T.title[lang]}</p>
          <p className="text-sm text-ink-3">{T.meta[lang]}</p>
        </div>
        <div role="group" aria-label="Register language" className="flex shrink-0 rounded-full bg-canvas p-1 ring-1 ring-line">
          {(["en", "bn"] as const).map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                lang === code ? "bg-paper font-semibold shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink"
              }`}
            >
              {code === "en" ? "English" : "বাংলা"}
            </button>
          ))}
        </div>
      </div>

      <div key={lang} lang={lang} className="animate-fade">
        <p className="px-5 pt-4 pb-2 text-sm text-ink-2">{T.hint[lang]}</p>
        <ul>
          {STUDENTS.map((s, i) => {
            const status = statuses[i];
            return (
              <li key={s.en}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-label={`${s[lang]}, ${T[status][lang]}`}
                  className="flex w-full items-center gap-4 px-5 py-2.5 text-left transition-colors hover:bg-canvas"
                >
                  <span className="w-5 text-sm text-ink-3 tabular-nums">{n(i + 1)}</span>
                  <span className="flex-1 text-[15px]">{s[lang]}</span>
                  <span
                    className={`w-[5.5rem] rounded-full border py-1 text-center text-[13px] font-medium transition-colors ${CHIP[status]}`}
                  >
                    {T[status][lang]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-dashed border-line px-5 py-3 text-sm text-ink-3">{T.rest[lang]}</p>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/60 px-5 py-4">
          <p className="text-sm font-medium" aria-live="polite">
            {summary}
          </p>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {saved ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                {T.saved[lang]}
              </>
            ) : (
              T.save[lang]
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
