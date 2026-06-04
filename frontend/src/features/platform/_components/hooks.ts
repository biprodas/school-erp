"use client";

import { useSession } from "next-auth/react";

/** Convenience hook: is the current session an admin platform user? */
export const useIsPlatformAdmin = (): boolean => {
  const { data: session } = useSession();
  return Boolean(session?.authKind === "platform" && session.user?.isAdmin);
}
