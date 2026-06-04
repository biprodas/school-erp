import { Badge } from "~/components/ui/badge";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "default",
  pending: "secondary",
  suspended: "destructive",
  banned: "destructive",
  inactive: "outline",
  deactivated: "outline",
  archived: "outline",
};

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
  user: "outline",
};

export const StatusBadge = ({ status }: { status: string }) => {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="capitalize">
      {status}
    </Badge>
  );
}

export const RoleBadge = ({ role }: { role: string }) => {
  return (
    <Badge variant={ROLE_VARIANT[role] ?? "outline"} className="capitalize">
      {role}
    </Badge>
  );
}
