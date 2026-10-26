"use client"

import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { useTranslations } from "next-intl"

import { onboardingKeys } from "~/features/onboarding/api"
import { toast } from "~/components/ui/toast"
import { isApiError, NETWORK_ERROR } from "~/lib/api/errors"

/** Backend codes with their own message under `onboarding.errors`. */
const CODES = {
  SESSION_OVERLAP: "sessionOverlap",
  INVALID_DATE_RANGE: "dateRange",
  SECTION_NAME_TAKEN: "sectionTaken",
  NO_CURRENT_SESSION: "noSession",
  ONBOARDING_INCOMPLETE: "incomplete",
  FOREIGN_KEY_VIOLATION: "inUse",
  [NETWORK_ERROR]: "network",
} as const

export type SetupErrorKey =
  (typeof CODES)[keyof typeof CODES] | "duplicate" | "invalid" | "failed"

/** The `onboarding.errors` key for a backend code (and HTTP status). */
export function setupCodeKey(code: string, status?: number): SetupErrorKey {
  if (code in CODES) return CODES[code as keyof typeof CODES]
  if (status === 409) return "duplicate"
  if (status === 400) return "invalid"
  return "failed"
}

/** The `onboarding.errors` key for a failed setup call. */
export const setupErrorKey = (error: unknown): SetupErrorKey =>
  isApiError(error) ? setupCodeKey(error.code, error.status) : "failed"

export function useSetupErrorMessage() {
  const t = useTranslations("onboarding.errors")
  return (error: unknown) => t(setupErrorKey(error))
}

/**
 * A setup mutation: on success the checklist (and `invalidate`) is
 * refetched and `success` is toasted; failures toast their message.
 */
export function useSetupAction<Variables, Result>({
  action,
  invalidate = [],
  success,
  onSuccess,
}: {
  action: (variables: Variables) => Promise<Result>
  invalidate?: QueryKey[]
  /** Toast title on success, or null for none. */
  success: ((result: Result) => string) | null
  onSuccess?: (result: Result) => void
}) {
  const queryClient = useQueryClient()
  const message = useSetupErrorMessage()

  return useMutation({
    mutationFn: action,
    onSuccess: async (result) => {
      await Promise.all(
        [onboardingKeys.checklist, ...invalidate].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      if (success) {
        toast.add({ title: success(result), type: "success", timeout: 4000 })
      }
      onSuccess?.(result)
    },
    onError: (error) =>
      toast.add({ title: message(error), type: "error", timeout: 8000 }),
  })
}
