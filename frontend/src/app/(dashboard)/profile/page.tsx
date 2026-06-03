import ProfileView from "~/features/user/profile";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details
        </p>
      </div>
      <ProfileView />
    </div>
  );
}
