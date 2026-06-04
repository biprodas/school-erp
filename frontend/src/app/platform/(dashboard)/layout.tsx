import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { PlatformHeader } from "./_components/platform-header";
import { PlatformSidebar } from "./_components/platform-sidebar";

export default function PlatformDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
