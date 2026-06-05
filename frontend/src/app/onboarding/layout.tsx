import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FaSchool } from "react-icons/fa6";
import { isPlatformHost } from "~/lib/tenant";

export const metadata: Metadata = {
  title: "Get started — SchoolERP",
  description: "Create your account and set up your school.",
};

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The wizard provisions platform accounts + new tenants, so it only makes
  // sense on the apex/platform host — never on a tenant subdomain.
  const host = (await headers()).get("host");
  if (!isPlatformHost(host)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6 md:p-10">
      <Link
        href="/"
        className="flex items-center gap-2 self-center font-medium"
      >
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FaSchool className="size-4" />
        </div>
        SchoolERP
      </Link>
      <div className="flex w-full max-w-md flex-col gap-6">{children}</div>
    </div>
  );
}
