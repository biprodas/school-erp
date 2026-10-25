import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // No hard-coded UI text (doc/frontend-implementation-plan.md 6): every
  // string comes from the message catalogs, so Bangla and Hindi readers
  // never meet English. Text in JSX and in attributes people read
  // (labels, titles, placeholders, alt text) is refused; punctuation is
  // fine. The marketing landing is English-only by design, and the design
  // system page is a developer showcase.
  {
    files: ["src/**/*.tsx"],
    ignores: [
      "src/features/marketing/**",
      "src/app/site/design-system/**",
      "src/**/*.test.tsx",
    ],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            " ",
            "·",
            " · ",
            ".",
            "(",
            ")",
            "–",
            "—",
            ":",
            "/",
            "%",
            "+",
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-valuetext|title|placeholder|alt)$/] > Literal[value=/[A-Za-z]/]",
          message:
            "Text people read comes from the message catalogs (useTranslations / getTranslations).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output.
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
  ]),
])

export default eslintConfig
