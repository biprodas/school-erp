import path from "node:path"

import type { NextConfig } from "next"

import { appConfig } from "./src/config/app-config"

// next-intl finds its request config through the `next-intl/config` alias.
// Its `createNextIntlPlugin` only sets this alias unless the experimental
// message extraction is on, but it loads `@swc/core` (a native addon) just
// to be imported, so the alias is set here instead.
const I18N_REQUEST_CONFIG = "./src/i18n/request.ts"

const ROOT_DOMAIN = appConfig.rootDomain

const nextConfig: NextConfig = {
  reactCompiler: true,
  // `next dev` only serves its scripts and HMR to localhost by default;
  // school and admin hosts are subdomains of the root domain.
  allowedDevOrigins: [ROOT_DOMAIN, `*.${ROOT_DOMAIN}`],
  turbopack: {
    resolveAlias: {
      // Turbopack aliases must be relative.
      "next-intl/config": I18N_REQUEST_CONFIG,
    },
  },
  // Only used by `next build --webpack`; webpack aliases must be absolute.
  webpack(config: { resolve: { alias: Record<string, string> } }) {
    config.resolve.alias["next-intl/config"] = path.resolve(I18N_REQUEST_CONFIG)
    return config
  },
}

export default nextConfig
