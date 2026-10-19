import type { Metadata } from "next";
import { FindSchoolPage } from "~/features/landing/find-school-page";

export const metadata: Metadata = {
  title: "Sign in to your school — Kampasy",
  description:
    "Every school on Kampasy has its own address. Enter yours to sign in.",
};

export default function FindSchool() {
  return <FindSchoolPage />;
}
