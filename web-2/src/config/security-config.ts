// Transport security of this deployment. No `~` imports and no
// `server-only`: `next.config.ts` reads this file too. Server code only
// (the variable isn't `NEXT_PUBLIC_*`, so the browser sees the default).

import { appConfig } from "./app-config"

/**
 * `ALLOW_INSECURE_HTTP=true` lets a production build run over plain HTTP:
 * the end-to-end suite runs `next start` on `http://*.lvh.me:3000`, where
 * browsers drop `Secure` cookies. Never set it on a real deployment.
 */
const allowInsecureHttp = process.env.ALLOW_INSECURE_HTTP === "true"

export const securityConfig = {
  /**
   * Served over HTTPS only: `Secure` cookies, HSTS and
   * `upgrade-insecure-requests`. On in production unless
   * `ALLOW_INSECURE_HTTP` says otherwise.
   */
  httpsOnly: appConfig.isProduction && !allowInsecureHttp,
  /** React and Turbopack need `eval` and a websocket in development. */
  development: !appConfig.isProduction,
} as const
