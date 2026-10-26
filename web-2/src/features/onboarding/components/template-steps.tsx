"use client"

import { useQuery } from "@tanstack/react-query"

import {
  onboardingTemplatesQuery,
  type OnboardingTemplates,
} from "~/features/onboarding/api"
import { Skeleton } from "~/components/ui/skeleton"

import { StepLoadFailed } from "./step-parts"

/** The templates, or a skeleton / retry while they load. */
export function WithTemplates({
  children,
}: {
  children: (templates: OnboardingTemplates) => React.ReactNode
}) {
  const templates = useQuery(onboardingTemplatesQuery())
  if (templates.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (templates.isError) return <StepLoadFailed retry={templates.refetch} />
  return children(templates.data)
}
