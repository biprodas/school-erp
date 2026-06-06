import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { ONBOARDING_CONTINUE } from "~/constants/routes";
import { getOnboardingTenant } from "~/features/onboarding/resume";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { PlatformHeader } from "./_components/platform-header";
import { PlatformSidebar } from "./_components/platform-sidebar";

export default async function PlatformDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resume gate: a non-admin platform owner whose tenant is still mid-onboarding
  // is funneled back into the wizard rather than left on the platform dashboard.
  // Super admins manage many tenants, so they're exempt.
  const session = await auth();
  if (session?.authKind === "platform" && !session.user.isAdmin) {
    const tenant = await getOnboardingTenant();
    if (tenant) {
      redirect(ONBOARDING_CONTINUE);
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
