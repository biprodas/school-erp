import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { PLATFORM_LOGIN_REDIRECT, TENANT_LOGIN } from "~/constants/routes";
import { resolveOwnerDestinationForSession } from "~/features/onboarding/resolve-session-destination";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { PlatformHeader } from "./_components/platform-header";
import { PlatformSidebar } from "./_components/platform-sidebar";

export default async function PlatformDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect(TENANT_LOGIN);
  }

  // Defense-in-depth: JWT onboarding status (proxy is the primary gate).
  if (session.authKind === "platform" && !session.user.isAdmin) {
    const destination = await resolveOwnerDestinationForSession(session);
    if (destination !== PLATFORM_LOGIN_REDIRECT) {
      redirect(destination);
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <PlatformSidebar variant="inset" />
      <SidebarInset>
        <PlatformHeader />
        <main className="flex flex-1 flex-col px-6 py-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
