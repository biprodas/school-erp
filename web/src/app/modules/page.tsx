import type { Metadata } from "next";
import { ModulesPage } from "~/features/landing/modules-page";

export const metadata: Metadata = {
  title: "Modules — Kampasy",
  description:
    "Every Kampasy module: academics, students, attendance, exams, fees, notices, admissions, timetable, HR, LMS, library, transport, hostel and inventory.",
};

export default function Modules() {
  return <ModulesPage />;
}
