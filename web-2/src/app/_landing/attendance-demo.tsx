"use client"

import { BellIcon, ReceiptTextIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { cn } from "~/lib/utils"

type Status = "present" | "late" | "absent"
type Lang = "en" | "bn"

const NEXT_STATUS: Record<Status, Status> = {
  present: "absent",
  absent: "late",
  late: "present",
}

const STATUS_LABEL: Record<Lang, Record<Status, string>> = {
  en: { present: "Present", late: "Late", absent: "Absent" },
  bn: { present: "উপস্থিত", late: "দেরি", absent: "অনুপস্থিত" },
}

const STATUS_STYLE: Record<Status, string> = {
  present: "border-transparent bg-secondary text-secondary-foreground",
  late: "border-dashed border-foreground/40 bg-transparent",
  absent: "border-destructive/30 bg-destructive/10 text-destructive",
}

const COPY = {
  en: {
    title: "Class 6, Section A",
    subtitle: "Morning shift, Monday 19 October",
    hint: "Everyone starts present. Tap a name to mark them absent or late.",
    rest: "Rolls 9 to 42, all present",
    save: "Save attendance",
    saved: "Saved",
  },
  bn: {
    title: "৬ষ্ঠ শ্রেণি, শাখা ক",
    subtitle: "প্রভাতি শাখা, সোমবার ১৯ অক্টোবর",
    hint: "সবাই উপস্থিত ধরে শুরু হয়। অনুপস্থিত বা দেরি চিহ্নিত করতে নামে চাপুন।",
    rest: "রোল ৯ থেকে ৪২, সবাই উপস্থিত",
    save: "হাজিরা সংরক্ষণ",
    saved: "সংরক্ষিত",
  },
}

const STUDENTS: { en: string; bn: string; initial: Status }[] = [
  { en: "Afsana Akter", bn: "আফসানা আক্তার", initial: "present" },
  { en: "Arif Hossain", bn: "আরিফ হোসেন", initial: "late" },
  { en: "Farhana Islam", bn: "ফারহানা ইসলাম", initial: "late" },
  { en: "Imran Kabir", bn: "ইমরান কবির", initial: "present" },
  { en: "Mehjabin Rahman", bn: "মেহজাবিন রহমান", initial: "present" },
  { en: "Nafis Chowdhury", bn: "নাফিস চৌধুরী", initial: "present" },
  { en: "Rafi Ahmed", bn: "রাফি আহমেদ", initial: "absent" },
  { en: "Sadia Sultana", bn: "সাদিয়া সুলতানা", initial: "present" },
]

// Rolls 9 to 42 are off-screen and all present.
const HIDDEN_PRESENT = 34

const BN_DIGITS = "০১২৩৪৫৬৭৮৯"
function num(n: number, lang: Lang) {
  const s = String(n)
  return lang === "bn" ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s
}

export function AttendanceDemo() {
  const [lang, setLang] = useState<Lang>("en")
  const [statuses, setStatuses] = useState(() => STUDENTS.map((s) => s.initial))
  const [saved, setSaved] = useState(false)

  const count = (status: Status) => statuses.filter((s) => s === status).length
  const present = count("present") + HIDDEN_PRESENT
  const summary =
    lang === "en"
      ? `${present} present, ${count("absent")} absent, ${count("late")} late`
      : `${num(present, lang)} উপস্থিত, ${num(count("absent"), lang)} অনুপস্থিত, ${num(count("late"), lang)} দেরি`
  const copy = COPY[lang]

  function toggle(index: number) {
    setSaved(false)
    setStatuses((prev) =>
      prev.map((s, i) => (i === index ? NEXT_STATUS[s] : s))
    )
  }

  return (
    <div className="relative">
      <Card className="gap-0 py-0 shadow-xl shadow-primary/5">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div>
            <p className="font-semibold">{copy.title}</p>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[lang]}
            onValueChange={(value) => value[0] && setLang(value[0] as Lang)}
            aria-label="Language"
          >
            <ToggleGroupItem value="en">English</ToggleGroupItem>
            <ToggleGroupItem value="bn" className="font-bangla">
              বাংলা
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="px-5 pt-4 text-sm text-muted-foreground">{copy.hint}</p>
        <ul className="px-2 py-2">
          {STUDENTS.map((student, i) => (
            <li key={student.en}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="flex w-full items-center gap-4 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="w-4 text-muted-foreground tabular-nums">
                  {num(i + 1, lang)}
                </span>
                <span className="flex-1">{student[lang]}</span>
                <span
                  className={cn(
                    "w-24 rounded-full border py-1 text-center text-xs font-medium",
                    STATUS_STYLE[statuses[i]]
                  )}
                >
                  {STATUS_LABEL[lang][statuses[i]]}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          {copy.rest}
        </p>
        <div className="flex items-center justify-between gap-4 border-t bg-muted/50 p-5">
          <p className="text-sm font-medium" aria-live="polite">
            {summary}
          </p>
          <Button
            size="lg"
            className="rounded-full px-4"
            onClick={() => setSaved(true)}
          >
            {saved ? copy.saved : copy.save}
          </Button>
        </div>
      </Card>

      <div className="absolute -top-6 -left-60 hidden w-64 rounded-xl bg-brand p-4 text-brand-foreground shadow-lg xl:block">
        <p className="flex items-center gap-1.5 text-xs opacity-80">
          <BellIcon className="size-3.5" />
          Guardian app · SMS
        </p>
        <p className="mt-1.5 font-bangla text-sm leading-relaxed">
          আজ রাফি স্কুলে অনুপস্থিত। কারণ জানাতে উত্তর দিন।
        </p>
        <p className="mt-1.5 text-xs opacity-70">
          Sent automatically at 9:15 AM
        </p>
      </div>

      <div className="absolute bottom-24 -left-40 hidden items-center gap-3 rounded-xl border bg-card p-3 shadow-lg xl:flex">
        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <ReceiptTextIcon className="size-4" />
        </span>
        <div className="text-sm">
          <p className="font-semibold">৳4,020 received</p>
          <p className="text-muted-foreground">Receipt 004817</p>
        </div>
      </div>
    </div>
  )
}
