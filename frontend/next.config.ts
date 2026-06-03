import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allow the dev server's /_next/* (HMR + chunks) to load from tenant
  // subdomains, otherwise the client bundle is blocked and pages don't hydrate
  // (links full-reload, forms native-submit). localhost is allowed by default.
  allowedDevOrigins: ["lvh.me", "*.lvh.me"],
};

export default nextConfig;
