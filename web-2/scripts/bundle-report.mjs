// Bundle report (doc/frontend-implementation-plan.md, M9): the compressed
// first-load JavaScript of every route, from the Turbopack analyzer's
// `route-bundle-stats.json` (`next analyze --output`, after `next build`
// so the chunk files exist). Fails when a sign-in or portal route goes
// over budget. The Playwright performance spec measures the same thing in
// a browser on Fast 3G.
//
//   npm run build && npm run analyze

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { gzipSync } from "node:zlib"

/**
 * Gzipped first-load JS for the routes a slow phone opens first. React DOM
 * and the Next.js router alone are ~115–125 KB of it.
 */
const BUDGET_BYTES = 320 * 1024
const BUDGETED =
  /^\/school\/(login|activate|forgot-password|reset-password|change-password|student)(\/|$)|^\/admin\/login$/

const root = process.cwd()
const statsFile = path.join(root, ".next/diagnostics/route-bundle-stats.json")
if (!existsSync(statsFile)) {
  console.error(
    "No route-bundle-stats.json: run `npm run build` then `npx next analyze --output`."
  )
  process.exit(1)
}

const gzipped = new Map()
function sizeOf(chunk) {
  if (!gzipped.has(chunk)) {
    const file = path.join(root, chunk.replaceAll("\\", "/"))
    if (!existsSync(file)) {
      console.error(
        `Missing ${chunk}: run \`npm run build\` before the report.`
      )
      process.exit(1)
    }
    gzipped.set(chunk, gzipSync(readFileSync(file), { level: 9 }).length)
  }
  return gzipped.get(chunk)
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
const rows = JSON.parse(readFileSync(statsFile, "utf8"))
  .map(({ route, firstLoadChunkPaths }) => ({
    route,
    files: firstLoadChunkPaths.length,
    gzip: firstLoadChunkPaths.reduce((sum, chunk) => sum + sizeOf(chunk), 0),
    budgeted: BUDGETED.test(route),
  }))
  .sort((a, b) => a.route.localeCompare(b.route))

const over = rows.filter((r) => r.budgeted && r.gzip > BUDGET_BYTES)
const lines = [
  "| Route | First-load JS (gzip) | Files | Budget |",
  "| ----- | -------------------: | ----: | ------ |",
  ...rows.map(
    (r) =>
      `| \`${r.route}\` | ${kb(r.gzip)} | ${r.files} | ${
        r.budgeted
          ? r.gzip > BUDGET_BYTES
            ? `**over ${kb(BUDGET_BYTES)}**`
            : `≤ ${kb(BUDGET_BYTES)}`
          : ""
      } |`
  ),
]
const report = lines.join("\n")
console.log(report)
writeFileSync(
  path.join(root, ".next/diagnostics/bundle-report.md"),
  `${report}\n`
)
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Bundle report\n\n${report}\n`,
    { flag: "a" }
  )
}

if (over.length) {
  console.error(`\nOver budget: ${over.map((r) => r.route).join(", ")}`)
  process.exit(1)
}
