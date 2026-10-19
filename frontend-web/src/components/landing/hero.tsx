import { Bell, Check, ReceiptText } from "lucide-react";
import { LINKS } from "~/config/site";
import { ButtonLink } from "../ui/button-link";
import { GridBackdrop } from "../ui/grid-backdrop";
import { AttendanceRegister } from "./attendance-register";

const ASSURANCES = ["No card required", "Running within a day", "Free up to 100 students"];

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <GridBackdrop glowAt="82% 40%" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-20 lg:pt-24 lg:pb-28">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-paper px-3.5 py-1.5 text-sm ring-1 ring-line">
            <span className="size-1.5 rounded-full bg-forest-2" aria-hidden="true" />
            Built for schools in Bangladesh, <span lang="bn">বাংলা</span> and English
          </p>
          <h1 id="hero-title" className="display mt-7 text-[3.6rem] text-balance sm:text-[5rem] lg:text-[5.6rem]">
            One register for the whole school.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl">
            Attendance, results, fees and notices on one mobile-first platform. Teachers mark a
            section in under a minute, guardians see their child&apos;s day in the portal, and the
            owner sees the day&apos;s collection before going home.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink size="lg" href={LINKS.signup} arrow>
              Get started free
            </ButtonLink>
            <ButtonLink size="lg" variant="outline" href="#how-it-works">
              Explore the demo
            </ButtonLink>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink-2">
            {ASSURANCES.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 text-forest-2" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-rise [animation-delay:150ms]">
          {/* Two small notes that show what saving the register sets off */}
          <div
            aria-hidden="true"
            className="absolute top-6 right-[calc(100%-1rem)] z-10 hidden w-60 rounded-2xl bg-forest p-4 text-white shadow-xl xl:block"
          >
            <p className="flex items-center gap-1.5 text-xs text-white/70">
              <Bell className="size-3.5 text-marigold" />
              Guardian portal, 10:00
            </p>
            <p lang="bn" className="mt-1.5 text-[15px] leading-snug">
              রাফি আহমেদ আজ বিদ্যালয়ে অনুপস্থিত।
            </p>
          </div>
          <div
            aria-hidden="true"
            className="absolute right-[calc(100%-1rem)] bottom-24 z-10 hidden w-max items-center gap-3 rounded-2xl bg-paper p-3 pr-5 ring-1 ring-line shadow-xl xl:flex"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-mint text-forest-2">
              <ReceiptText className="size-4" />
            </span>
            <span className="text-sm leading-tight">
              <span className="block font-semibold">৳4,020 received</span>
              <span className="text-ink-3">Receipt 004817</span>
            </span>
          </div>

          <AttendanceRegister />
          <p className="mt-4 text-center text-sm text-ink-3">
            Try it. This is the screen a teacher uses at the start of class.
          </p>
        </div>
      </div>
    </section>
  );
}
