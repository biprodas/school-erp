import * as React from "react"

const subscribe = () => () => {}

/**
 * False during SSR and hydration, true once rendering on the client. For UI
 * that depends on browser-only state (e.g. the resolved theme) and must not
 * cause a hydration mismatch.
 */
export function useMounted() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
