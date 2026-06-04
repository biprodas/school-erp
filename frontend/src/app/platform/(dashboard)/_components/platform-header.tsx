"use client";

import Link from "next/link";
import { FaSchool } from "react-icons/fa6";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { UserButton } from "~/components/user-button";
import { PLATFORM_LOGIN_REDIRECT } from "~/constants/routes";

export function PlatformHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-1 data-[orientation=vertical]:h-4"
      />
      <Link
        href={PLATFORM_LOGIN_REDIRECT}
        className="flex items-center gap-2 font-medium"
      >
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FaSchool className="size-4" />
        </div>
        SchoolERP Platform
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <UserButton />
      </div>
    </header>
  );
}
