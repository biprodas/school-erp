import { PlatformHeader } from "./_components/platform-header";

export default function PlatformDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col">
      <PlatformHeader />
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
