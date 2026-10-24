import path from "node:path"

import type { NextConfig } from "next"

// next-intl finds its request config through the `next-intl/config` alias.
// Its `createNextIntlPlugin` only sets this alias unless the experimental
// message extraction is on, but it loads `@swc/core` (a native addon) just
// to be imported, so the alias is set here instead.
const I18N_REQUEST_CONFIG = "./src/i18n/request.ts"

const nextConfig: NextConfig = {
  reactCompiler: true,
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
