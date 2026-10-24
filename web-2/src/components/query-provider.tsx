"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState } from "react"

import { isApiError } from "~/lib/api/errors"

/** Client errors (4xx) won't change on a retry; other failures get two. */
const retry = (failureCount: number, error: unknown) =>
  !(isApiError(error) && error.status >= 400 && error.status < 500) &&
  failureCount < 2

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

/**
 * One QueryClient per browser tab (kept in state so re-renders don't make a
 * new cache). The devtools are left out of production builds by the package.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  )
}
