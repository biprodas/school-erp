import { redirect } from "next/navigation";
import { auth } from "~/auth";
import { ROUTES } from "~/constants";
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
    redirect(ROUTES.TENANT_LOGIN);
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
