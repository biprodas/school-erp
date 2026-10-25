# Frontend architecture and tech stack

| Field   | Value                                                        |
| ------- | ------------------------------------------------------------ |
| Status  | Proposed (replaces the existing `frontend/`, which is rebuilt from scratch) |
| Date    | 2026-10-19                                                   |
| Related | `prd.md` 1.3, 6.3, 6.14, 8.1, 8.3, 8.5–8.7, 11; `domains-and-routing.md` |

This document records the tech stack and architecture for the new frontend and why each choice was made. `prd.md` holds the requirements and `domains-and-routing.md` holds the host, sign-in and domain design. This document covers how the frontend implements them.

---

## 1. Requirements that drive the choices

| Requirement | Source | Consequence |
| ----------- | ------ | ----------- |
| One app serves many hosts: `<slug>.mydomain.com`, custom domains, `admin.mydomain.com`, the marketing apex | `domains-and-routing.md` 1, 7 | Host-based routing on the server |
| Host-only session cookies; cross-host sign-in via one-time handoff codes | `domains-and-routing.md` 5, PRD 6.3, 8.1 | Server route handlers that set cookies |
| Browsers call `/api/*` on their own host (no CORS per custom domain) | `domains-and-routing.md` 6 | A same-origin proxy in the frontend server |
| Public school home page and marketing site | `domains-and-routing.md` 1 | Server rendering, SEO |
| First contentful paint < 3 s on 3G, mid-range Android; every core flow works at 360 px | PRD 1.3, 6.14, 8.3 | Small bundles, server rendering, no heavy UI kit |
| Installable PWA; attendance and marks queued offline (Phase 1b) | PRD 8.7, 12 | Service worker, persisted mutation queue |
| Bangla and English, switchable at runtime; Bangla numerals, lakh grouping, Asia/Dhaka | PRD 8.6, 6.14 | i18n library without locale-prefixed URLs |
| Keyboard-friendly marks and attendance grids; WCAG 2.1 AA; light and dark themes | PRD 8.5 | Accessible primitives, a solid table/grid layer |
| Native apps later (Phase 2) | PRD 6.14, 12 | Backend stays a bearer-token API; web-specific auth lives in the frontend |
| E2E tests for critical flows | PRD 11 | A test runner and Playwright from day one |

---

## 2. Stack summary

| Area | Choice | Rejected |
| ---- | ------ | -------- |
| Framework | **Next.js 16** (App Router, React 19, React Compiler, Turbopack) | Vite SPA, TanStack Start |
| Auth / session | **Custom thin session layer** (BFF): sealed, httpOnly, host-only cookie; backend stays the auth server | NextAuth v5, Better Auth |
| Server state | **TanStack Query v5** | SWR |
| Client state | **Zustand** (global UI state), **nuqs** (URL state) | Redux Toolkit |
| UI components | **shadcn/ui** on **Base UI** primitives, **Tailwind v4** | antd, mixing antd + shadcn |
| Tables / grids | **TanStack Table**; AG Grid Community only if the marks grid needs it | antd Table |
| Forms | **react-hook-form + zod** | Formik |
| API client and types | **Generated from the backend OpenAPI spec** (orval or hey-api) | Hand-written endpoint modules |
| i18n | **next-intl** (no i18n routing) | next-i18next, locale-prefixed URLs |
| PWA / offline | **Serwist** + **Dexie** (IndexedDB) | next-pwa (unmaintained) |
| Charts | **Recharts** (via shadcn charts) | — |
| Dates | **date-fns** (+ `@date-fns/tz` for Asia/Dhaka) | moment, dayjs |
| Icons | **lucide-react** | react-icons (large, mixed sets) |
| Toasts | **sonner** | — |
| Testing | **Vitest + Testing Library** (unit/component), **Playwright** (E2E) | Jest |
| Tooling | ESLint (flat config) + Prettier, TypeScript strict | — |

---

## 3. Decisions

### 3.1 Next.js, not Vite

Every school host needs server-side behavior: resolving the tenant from the host, the `/auth/handoff` route handler, the Google sign-in return, the onboarding gate, the `/api/*` proxy, and server-rendered public and portal pages for the 3G target. Next.js provides all of these in one deployable.

A Vite SPA would need a separate server or reverse proxy (nginx, Caddy, a small Node BFF) for the proxy, handoff and cookie handling, and would push tokens into browser JavaScript or require backend cookie changes. Vite is the better fit only for a purely internal app with no SSR or server routes, which this is not.

TanStack Start (Vite-based, full-stack) could meet the same requirements but is younger. The project's conventions and docs are already built around Next 16, so Next stays.

> Next.js 16 has breaking changes compared with older versions (for example, middleware lives in `src/proxy.ts`). Read `node_modules/next/dist/docs/` before writing framework code.

### 3.2 Auth: a thin session layer, not an auth library

The NestJS backend already is the auth server: credentials with lockout, sessions (`user_sessions`), rotating refresh tokens with reuse detection, handoff codes, and Google OAuth (`domains-and-routing.md` 5a). The frontend only needs to hold the tokens safely on each host.

- **Better Auth** is an auth server with its own database tables and flows. It would duplicate `users`, sessions and OAuth that the backend owns.
- **NextAuth / Auth.js v5** is still beta, and Auth.js is in security-patch-only maintenance under the Better Auth team since September 2025. Its Credentials provider with refresh rotation inside the `jwt` callback is awkward and hides the session model.

The custom layer is small (roughly 200 lines) and fully under our control. See section 5.

### 3.3 TanStack Query, not SWR

TanStack Query has first-class mutations, cache invalidation by key, optimistic updates, devtools, and persisted queries/mutations with offline resume, which is how offline attendance and marks entry are implemented (section 8). SWR covers reads well but leaves mutations and offline queues to hand-rolled code.

### 3.4 Zustand + nuqs, not Redux

Almost all state is server state and lives in TanStack Query. What remains is small: the selected child for a guardian, the active role context for a teacher who is also a guardian, sidebar and theme toggles. Zustand handles that with no boilerplate. Filters, sort and pagination go in the URL with **nuqs**, so lists are shareable and survive refresh. Redux adds ceremony with no benefit here.

### 3.5 shadcn/ui only, not antd

- antd is heavy, its CSS-in-JS runtime conflicts with React Server Components and streaming, and it works against the 3G paint target.
- shadcn components are copied into the repo (`src/components/ui`), styled with Tailwind, tree-shaken, accessible, and themeable for light/dark and per-school branding (logo, primary color via CSS variables).
- Shipping two design systems (as the old frontend did with antd + shadcn) is ruled out.
- **Base UI** is the primitive layer for a fresh start; pick it at `shadcn init` and do not mix in Radix.

### 3.6 Tables and data-entry grids

- List pages (students, invoices, staff): **TanStack Table** wrapped in a shared `DataTable` component with server-side pagination (`?page=&limit=`, the backend `meta` envelope), sorting and filters bound to the URL.
- Marks and attendance entry (PRD 8.5): a dedicated grid component on TanStack Table with arrow/Enter/Tab navigation, inline validation and bulk actions. If keyboard editing, virtualization and copy-paste become too costly to build, switch only this grid to **AG Grid Community**.

### 3.7 Generated API client

The backend serves OpenAPI at `/api/docs`. Generate the client from it:

- **orval** (or **hey-api**) generates typed request functions and TanStack Query hooks per tag into `src/api/generated/`.
- A custom fetcher (section 5.3) unwraps the `{ success, statusCode, message, data, meta }` envelope and normalizes errors to `ApiError` (carrying the backend `code`).
- `npm run api:generate` runs against a local backend; the generated output is committed so builds don't need the backend.
- Optionally generate zod schemas from the same spec for form validation, extending them where the UI needs stricter rules.

This removes the hand-written `apis/` layer and makes DTO drift a type error.

### 3.8 i18n: next-intl without locale routing

The host already carries the tenant, so URLs are not prefixed with `/bn` or `/en`. The locale comes from the user's preference, then the school default, stored in a cookie and read on the server. Messages live in `messages/en.json`, `bn.json` and `hi.json`. Two guards keep them complete:

- **ESLint** (`eslint.config.mjs`) refuses text in JSX (`react/jsx-no-literals`, punctuation allowed) and in the attributes people read (`aria-label`, `title`, `placeholder`, `alt`, …) across `src/**/*.tsx`, shadcn `components/ui` included. The marketing landing (English-only by design) and the `/design-system` showcase are exempt.
- **Vitest** (`i18n/messages.test.ts`) checks that the three catalogs have the same keys and the same `{placeholders}` (ICU arguments included), that nothing is empty, and that Bangla and Hindi values aren't untranslated English copies (a short allowlist covers language names and sample input).

Formatting goes through shared helpers on `Intl`:

- Money: `Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' })` gives lakh grouping (৳১,০০,০০০) and Bangla digits; `en-IN` grouping for English.
- Dates: Asia/Dhaka by default, per-tenant override; Bangabda and Hijri display as optional formatters (PRD 8.6).
- Names: show the field that matches the active locale, falling back to the other.

Fonts: self-hosted through `next/font` with `font-display: swap`: Hind Siliguri (Latin and Bangla), Hind (Devanagari, for Hindi), Bricolage Grotesque (headings), Noto Sans Bengali and Geist Mono. Every subset gets an `@font-face` with its `unicode-range`, so a file downloads only when the page shows those characters; `subsets` only decides preloading, and only the Latin faces English pages paint with are preloaded. Preloading everything made an English page fetch ~700 KB of fonts it never used (M9).

### 3.9 PWA and offline

- **Serwist** generates the service worker: an offline app shell, cached static assets, and a network-first strategy for API reads. Verify the Turbopack integration in development before relying on it; production builds are supported.
- Offline writes (attendance, marks) are queued in **IndexedDB (Dexie)** and replayed through TanStack Query's persisted mutations when the device reconnects. Every queued write carries an idempotency key so the backend's `@Idempotent()` endpoints deduplicate retries.
- The PWA and offline sync ship in Phase 1b; Phase 1a only needs a manifest and a correct mobile layout.

---

## 4. Application structure

One Next.js app serves every host. `src/proxy.ts` resolves the host and rewrites to an internal route group, so the browser URL stays clean.

| Host | Internal tree | Contents |
| ---- | ------------- | -------- |
| `mydomain.com` | `app/(marketing)` | Landing, pricing, signup, "Find your school" |
| `admin.mydomain.com` | `app/(platform)` | Super-admin: schools, plans, platform users |
| `<slug>.mydomain.com`, custom domains | `app/(school)` | `/`, `/login`, `/activate`, `/onboarding`, `/dashboard/*`, `/student/*`, `/auth/handoff` |

`proxy.ts` responsibilities, in order:

1. Resolve the host: apex → marketing, `admin.` → platform, subdomain → slug (reject reserved slugs), anything else → custom-domain lookup through the backend public endpoint (cached).
2. Redirect a school's subdomain to its primary custom domain when one is active (except `/auth/handoff`).
3. Redirect old slugs to the current one (once slug history exists).
4. Gate auth: unauthenticated users on protected paths go to `/login?next=…`.
5. Onboarding gate: while `onboarding_completed_at` is null, school admins go to `/onboarding` and other users see the "being set up" page.
6. Rewrite to the internal route group and pass the resolved tenant downstream in a request header.

Folder layout (`web-2/src/`; `web-2/README.md` has the full tree, the feature convention and the import rules):

```
app/                      # routing only
  site/                   # apex: landing, signup, find-school
  admin/                  # admin host
  school/                 # every school host
    (auth)/  onboarding/
    dashboard/            # staff, permission-gated sidebar
    student/              # student and guardian portal
    auth/handoff/route.ts
  api/[...path]/route.ts  # BFF proxy (section 5)
  api/session/logout/
features/<domain>/        # api.ts, actions.ts, schemas.ts, use-*.ts, components/, server/
                          # e.g. auth, access (<Can>), shell (sidebar), students, fees, …
components/
  ui/  brand/  forms/  layouts/  providers/  common/  data-table/ (with the first list)
lib/
  api/                    # fetch clients (browser → BFF, server → backend), envelope, ApiError
  auth/                   # session cookie sealing, refresh, gates (server-only)
  bff/  tenancy/  security/  forms/
  format.ts               # money, dates, numerals
api/generated/            # orval/hey-api output (committed), once the generator is chosen
hooks/  config/  i18n/  ../messages/
proxy.ts
```

The internal trees are real segments, not route groups: route groups don't change URLs, so two of them can't both own `/login` (`frontend-implementation-plan.md` 2.1). Shared code (`components/`, `lib/`, `hooks/`) never imports features or routes (enforced by ESLint).

Route groups per persona keep bundles small: a guardian on 3G never downloads the staff dashboard code.

### 4.1 Shared package (optional)

The reserved-slug list, permission keys and shared enums must match between backend and frontend (`domains-and-routing.md` 2). Either generate them from the OpenAPI spec, or move to a pnpm workspace with a small `packages/shared` imported by both projects.

---

## 5. Session and API access (BFF)

```
Browser ──/api/*──► Next route handler ──Bearer + x-tenant-id──► NestJS /api
          httpOnly, host-only cookie                (unchanged, bearer-only;
          holding sealed access + refresh            native apps use the same API)
```

### 5.1 Session cookie

- One cookie per host, no `Domain` attribute (host-only), `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. `Secure` (with HSTS and `upgrade-insecure-requests`) follows `securityConfig.httpsOnly`: on in production unless `ALLOW_INSECURE_HTTP=true`, which only the end-to-end suite sets to run `next start` over plain HTTP on `lvh.me`.
- Contents: access token, refresh token, access-token expiry and a minimal user snapshot (id, name, `isAdmin`, `mustChangePassword`), sealed with **jose** (JWE) using a server secret.
- Tokens never reach browser JavaScript, so an XSS bug cannot exfiltrate them.
- Platform sessions on `admin.` use a separate cookie name and the platform realm.

### 5.2 Flows

| Flow | Implementation |
| ---- | -------------- |
| Login | Server action or `POST /api/session/login` → backend `POST /auth/login` → set cookie → redirect |
| Handoff | `GET /auth/handoff?code&next` → backend `POST /auth/handoff` → set cookie → redirect to same-host `next` |
| Google | Redirect to the start URL on `mydomain.com`; it returns through `/auth/handoff` |
| Refresh | Inside the BFF on 401 or near expiry: call the backend refresh endpoint once, rewrite the cookie, retry. Concurrent requests share one in-flight refresh per session to avoid triggering refresh-token reuse detection |
| Logout | Backend revoke, then clear the cookie |
| Must change password | `mustChangePassword` in the snapshot; `proxy.ts` restricts navigation to the change-password page |

### 5.3 API calls

- **Browser** (client components, TanStack Query): relative `/api/...` on the current host. The catch-all `app/api/[...path]/route.ts` reads the cookie, adds `Authorization` and `x-tenant-id`, forwards to the backend, streams the response (file uploads and downloads included), and handles refresh.
- **Server** (RSC, server actions): call the backend directly with the same helper, reading the cookie through `cookies()`.
- **CSRF**: `SameSite=Lax` plus a required custom header (`x-requested-with`) on mutating requests through the BFF.
- The backend keeps resolving the tenant and rejecting tokens for another org (`JwtStrategy`), so a cookie copied to another school's host is still refused.

### 5.4 Permissions in the UI

After login, fetch the member's effective permissions once (cached in TanStack Query, refetched on focus so role changes apply on the next request, PRD 6.3). `features/access` exposes `allows(permissions, { permission: 'fees:collect' })`, `usePermissions()` and a `<Can>` component; sidebar items declare required permissions. This is UI gating only; the backend enforces every permission.

### 5.5 Security headers and CSP

- **CSP per page** (`lib/security/security-headers.ts`, set by `src/proxy.ts` on every rewritten page): `script-src 'self' 'nonce-…' 'strict-dynamic'` with a fresh nonce per response. Next.js reads it from the request's CSP header and adds it to its own scripts; the root layout passes it (`x-nonce`) to the theme script. No `unsafe-eval` in production, no inline scripts without the nonce. Styles allow `'unsafe-inline'` (style attributes: popover positioning, the school color). Images: self, `data:`, `blob:`, `https:` (signed file-store URLs; plain `http:` too in development for the local MinIO). `connect-src 'self'` (the browser only talks to the BFF), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Every page renders dynamically, so the nonce always applies.
- **Static headers** (`next.config.ts`, every response, the BFF and files included): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` turning off camera, microphone, geolocation, payment and USB, `Cross-Origin-Opener-Policy: same-origin`, HSTS when HTTPS-only; no `X-Powered-By`.
- **Server-action redirects across hosts**: Next.js renders a server action's `redirect()` target in-process, re-sending the already rewritten headers to its own origin (so the browser's Host is lost). The proxy answers such a request (it carries our `x-host-kind`) with an empty 204, and Next.js navigates on the client instead, through the proxy with the right Host.
- **Sessions the backend refused**: a server layout that gets 401 sends the user to `/auth/session-ended`, a route handler that deletes the cookie before `/login` (layouts can't), so a session ended elsewhere doesn't loop between `/login` and the home page.

---

## 6. UI conventions

- **Mobile first**: design at 360 px, then scale up. Data tables collapse to card lists on small screens; attendance marking is a one-tap list.
- **Theme**: shadcn CSS variables for light/dark; per-school primary color and logo from school settings, applied as CSS variables at the layout level.
- **Forms**: one `Form` wrapper over react-hook-form + zod; backend validation errors (400) map back to fields. Schemas the browser loads use `zod/mini` (the full API added ~40 KB to every sign-in page); the resolver takes any zod 4 schema through `zod/v4/core`. Server-only code may use classic zod.
- **Feedback**: Base UI toasts for mutations; skeletons for loading; empty states with a next action.
- **Long jobs** (imports, report cards, bulk invoices): enqueue, then poll the jobs API and show progress.
- **Printing**: PDFs come from the backend (`PdfService`); the frontend only downloads or opens them. Print CSS only for simple on-screen lists.
- **Accessibility**: Base UI primitives, visible focus, labelled inputs, contrast checked in both themes; axe (WCAG 2.1 A/AA, light and dark) on every page the Playwright suites open. Controls named for a person show decorative initials as CSS content (`InitialsAvatar`), so the visible text never contradicts the accessible name; the language switch is a native `<select>`; tables that scroll sideways take keyboard focus while they overflow.

---

## 7. Performance budget

| Target | How |
| ------ | --- |
| FCP < 3 s on 3G (PRD 8.3) | Server components by default, `"use client"` only on interactive leaves; route groups per persona; self-hosted subset fonts; `next/image` for logos and photos |
| Initial JS for sign-in and portal routes | ≤ 320 KB compressed, checked twice in CI: `npm run analyze` (Turbopack's `next analyze --output`, then `scripts/bundle-report.mjs`, a per-route table in the job summary) and the Playwright performance spec in a browser. React DOM and the Next.js router and runtime alone are ~115–125 KB; a page with only the root layout's providers is ~195 KB. Measured in M9: `/login` 264 KB, `/student` 293 KB. The early ~150 KB target can't hold on this stack |
| Time to interactive on Fast 3G | ≤ 6 s for `/login` and `/student` (Playwright, Chrome's Fast 3G preset, cold cache); measured ~5 s and ~3.5 s |
| Lists | Server pagination (max 100 rows); virtualize long grids |
| Data | Prefetch on the server and hydrate TanStack Query; avoid client waterfalls |

---

## 8. Offline design (Phase 1b)

1. The service worker caches the app shell and the attendance/marks routes for the user's own classes.
2. Reference data (class rosters, subjects, grading scale) is cached in IndexedDB when the teacher opens the screen online.
3. A save while offline writes to the Dexie queue with an idempotency key and marks the rows "pending sync".
4. On reconnect (or background sync where supported), the queue replays in order; conflicts (409) surface as a review list rather than silent overwrites.

---

## 9. Testing

| Level | Tool | Scope |
| ----- | ---- | ----- |
| Unit | Vitest | Formatters (money, Bangla numerals, dates), permission helpers, session sealing and refresh logic, `tenant.ts` host resolution |
| Component | Vitest + Testing Library | Forms, data-entry grid keyboard behavior, `<Can>` gating |
| E2E | Playwright (`web-2/e2e/`, against the docker-compose stack, `next start` in CI) | Signup through onboarding, sign-in by email and phone, lockout, invite activation (Mailpit API), forced password change, teacher vs admin, cookies bound to their school, used handoff codes, sign-out and sign-out everywhere, keyboard-only use, the guardian portal across two schools, the admin console; axe on every page; CSP, headers and no tokens in the browser; Fast 3G budgets. Each test signs up its own school; every page error or CSP violation fails the test. 360 px (Pixel 5) and desktop projects. Later slices add attendance, marks and fees |

---

## 10. Implementation order

1. Scaffold Next 16 + Tailwind v4 + shadcn (Base UI), ESLint/Prettier, Vitest, Playwright.
2. `proxy.ts` host resolution and route groups (marketing, platform, school).
3. Session layer: cookie sealing, login, logout, refresh, BFF proxy, handoff route.
4. OpenAPI client generation and the envelope fetcher; TanStack Query provider.
5. next-intl with Bangla and English, formatters, fonts.
6. App shell: layouts, role-gated sidebar, `DataTable`, `Form`, permissions helpers.
7. Feature screens in PRD Phase 1a order: onboarding, academic structure, SIS, attendance, exams, fees, portal, notices, dashboards.
8. Phase 1b: Serwist PWA, offline queue, web push.

---

## 11. Open questions

- One app versus a separate `admin` app: start with one; split if platform admin needs different deployment or IP restrictions.
- orval versus hey-api: decide after generating the current spec with both and comparing the output.
- Whether the marks grid needs AG Grid: decide after the first marks-entry prototype on TanStack Table.
- Monorepo with a shared package versus generating shared constants from OpenAPI.
