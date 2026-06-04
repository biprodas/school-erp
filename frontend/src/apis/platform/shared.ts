"use client";

import { useSession } from "next-auth/react";
import { ApiError } from "~/types/api";

/** Pull a human-readable message off an ApiError (or any error). */
export const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

/** True once the session is an authenticated platform session. */
export const usePlatformQueryEnabled = (): boolean => {
  const { data: session, status } = useSession();
  return status === "authenticated" && session?.authKind === "platform";
}
