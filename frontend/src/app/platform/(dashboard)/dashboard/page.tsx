import PlatformDashboardView from "~/features/platform/dashboard";

export default function PlatformDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform</h1>
        <p className="text-sm text-muted-foreground">
          Manage tenants, users, and platform settings
        </p>
      </div>
      <PlatformDashboardView />
    </div>
  );
}
