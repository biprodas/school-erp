"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import {
  LogOutIcon,
  CircleUserRoundIcon,
  CreditCardIcon,
  BellIcon,
} from "lucide-react";
import { ThemeSegmentControl } from "./theme-segment-control";
import { ROUTES } from "~/constants";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/components/ui/avatar"

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

export function UserButton() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Link href={ROUTES.TENANT_LOGIN}>
        <Button variant="outline" size="sm">Sign in</Button>
      </Link>
    );
  }

  const name = session.user.name ?? "Account";
  const email = session.user.email ?? "";
  const avatar = session.user.image ?? "";
  const initials = getInitials(name);

  // Sign out without NextAuth's redirect: its server-inferred base URL drops the
  // tenant subdomain (lands on the apex/localhost). Clear the session, then
  // soft-navigate to `/login` — a relative push stays on the current host and
  // avoids a full page reload.
  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push(ROUTES.TENANT_LOGIN);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-lg">
          <Avatar className="size-8 rounded-lg">
            <AvatarImage src={avatar} alt={name} className="rounded-lg" />
            <AvatarFallback className="rounded-lg bg-primary text-white font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 space-y-1">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback className="rounded-lg bg-primary text-white font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuLabel className="font-normal">
          <ThemeSegmentControl />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <CircleUserRoundIcon />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <BellIcon />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
