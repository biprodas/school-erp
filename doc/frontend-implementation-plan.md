# Frontend implementation plan (web-2)

| Field   | Value |
| ------- | ----- |
| Status  | Proposed |
| Date    | 2026-10-24 |
| Scope   | `web-2/`: host routing, sign-in flows (school and platform), session layer, app shell and role dashboards |
| Related | `frontend-architecture.md` (stack and design decisions), `domains-and-routing.md` (hosts, handoff, Google), `prd.md` 6.2, 6.3, 6.14, 8.x, `error-codes.md` |

`web-2/` is the new frontend, built from scratch. It replaces `frontend/` and follows the stack and decisions in `frontend-architecture.md`. The landing page and the design system page (`/design-system`) are done. This plan covers the next slice: getting every kind of user signed in on the right host and onto a working dashboard. Feature screens (students, attendance, exams, fees, …) come after it and reuse what is built here.

---

## 1. Starting point

**Already in `web-2/`:**

- Next.js 16.4, React 19.3, React Compiler, Tailwind v4, TypeScript, ESLint + Prettier.
- shadcn `base-nova` style on Base UI (`components.json`), with most components in `src/components/ui` (sidebar, field, input-otp, dialog, table, chart, toast, …).
- Fonts (Hind Siliguri, Bricolage Grotesque, Noto Sans Bengali, Geist Mono), `next-themes` and the Base UI toast manager in the root layout.
- Landing page at `app/page.tsx` with sections in `app/_landing/`. Its calls to action point at placeholders in `app/_landing/links.ts` (`SIGNUP_HREF = "#get-started"`, `FIND_SCHOOL_HREF = "/find-school"`).

**Not there yet:** host routing (`src/proxy.ts`), session handling, API client, TanStack Query, forms, i18n, tests.

**Backend (MVP done) endpoints this plan uses:**

| Area | Endpoints |
| ---- | --------- |
| Host resolution | `GET /public/organizations/resolve?host=` → `{ slug, name }`; `GET /public/organizations/by-slug?slug=` (gives `movedFrom` for an old slug); 410 `TENANT_MOVED` |
| School home | `GET /public/organizations/:slug/home` |
| Tenant auth | `POST /auth/login` (`identifier` + `password`), `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/me`, `POST /auth/handoff`, `GET`/`POST /auth/activate`, `POST /auth/forgot-password`, `GET`/`POST /auth/reset-password`, `GET`/`POST /auth/verify-email`, `POST /auth/change-password`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` |
| Platform auth | `POST /platform/auth/login`, `refresh`, `logout`, `me`, `POST /platform/auth/handoff` (issue a school code), `POST /platform/auth/handoff/exchange` |
| Google | `GET /oauth/google/start?return=&next=&intent=signin|signup|link` (404 `GOOGLE_SIGNIN_DISABLED` when not configured); link/unlink under `/auth/identities/google` |
| Signup | `POST /public/signup` → `{ status: 'verification_sent' }` or `{ status: 'created', redirectUrl }`; `POST /public/signup/verify`; `GET /public/slugs/check`, `GET /public/slugs/reserved` |
| Find school | `POST /public/find-school` (uniform response) |
| Onboarding | `GET /onboarding/checklist`, `POST /onboarding/complete`, `POST /onboarding/skip`, `GET /onboarding/templates`, `POST /onboarding/templates/...` |
| Dashboards | `GET /dashboards/admin` (`dashboard_admin:read`), `GET /dashboards/teacher` (`dashboard_teacher:read`), `GET /dashboards/accountant` (`dashboard_accountant:read`) |
| Shell | `GET /settings/display` (name, logo, colors, locale), `GET /notifications/unread-count`, `GET /notifications`, `GET /portal/children`, `GET /portal/schools` |

Token response from `login`, `handoff` and `activate`: `{ access_token, refresh_token, refresh_expires_at, token_type, mustChangePassword, user: { id, email, phone, name, roles, status, isAdmin }, organization: { id, slug } }`. `GET /auth/me` adds `membershipId`, `permissions`, `identities` and `organization.{ name, onboardingCompletedAt }`.

### 1.1 Backend gaps to close first

| # | Gap | Proposal |
| - | --- | -------- |
| B1 | ~~No endpoint gives the signed-in member's effective permission keys.~~ **Done.** | `GET /auth/me` returns `permissions: string[]`: the member's effective keys, sorted, retired keys left out (`RoleService.effectivePermissions`). School admins get the whole catalog, since they pass every check. Refetch it on focus so role changes show up. |
| B2 | No tenant endpoint gives the school's plan modules, so the UI cannot hide or badge features outside the plan. | Add `modules: string[]` and the plan/trial state (`plan`, `trialEndsAt`) to `GET /auth/me` or `GET /settings/display`. |
| B3 | `JWT_EXPIRES_IN=7d` in `.env.example`. A long-lived access token weakens session revocation for the BFF. | Use a short access TTL (15 min) in all envs; the BFF refreshes transparently (section 4.3). Not a blocker. |

B2 can follow; until then everything in the plan is shown.

---

## 2. Target structure

### 2.1 Hosts and internal trees

Route groups don't change URLs, so two groups can't both own `/login`. Each host type therefore gets a real internal segment, and `src/proxy.ts` rewrites the public URL into it. Direct requests to an internal segment are answered with 404.

| Host (dev) | Host (prod) | Internal tree | Public paths |
| ---------- | ----------- | ------------- | ------------ |
| `lvh.me:3000`, `localhost:3000` | `mydomain.com` | `app/site/` | `/`, `/signup`, `/signup/verify`, `/find-school`, `/design-system` |
| `admin.lvh.me:3000` | `admin.mydomain.com` | `app/admin/` | `/login`, `/auth/handoff`, `/` (platform dashboard), `/schools`, … |
| `<slug>.lvh.me:3000`, custom domains | `<slug>.mydomain.com`, custom | `app/school/` | `/`, `/login`, `/activate`, `/forgot-password`, `/reset-password`, `/verify-email`, `/change-password`, `/onboarding`, `/setting-up`, `/dashboard/*`, `/student/*`, `/auth/handoff` |

`app/api/` (BFF) is shared by all hosts and not rewritten.

### 2.2 Folder layout

```
src/
  proxy.ts                         # host → tree rewrite, auth and onboarding gates
  app/
    layout.tsx                     # root: fonts, theme, toast, QueryProvider
    site/                          # apex (marketing)
      page.tsx                     # landing (moved from app/page.tsx)
      _landing/                    # moved from app/_landing
      signup/  signup/verify/  find-school/  design-system/
    admin/                         # platform host
      login/  auth/handoff/route.ts
      (app)/layout.tsx  (app)/page.tsx
    school/                        # every school host
      page.tsx                     # public school home
      (auth)/layout.tsx            # centered card with school logo and name
      (auth)/login/  activate/  forgot-password/  reset-password/  verify-email/
      change-password/  setting-up/
      onboarding/                  # wizard (own layout, no sidebar)
      dashboard/                   # staff app shell
        layout.tsx                 # sidebar + header, session and permissions
        page.tsx                   # role-aware home dashboard
        [...slug]/page.tsx         # "coming soon" for links not built yet
        account/                   # profile, password, sessions, Google link
      student/                     # portal shell + home (placeholder in this slice)
      auth/handoff/route.ts
    api/
      [...path]/route.ts           # BFF proxy to the backend
      session/login/route.ts       # (or server actions; see 4.2)
      session/logout/route.ts
  lib/
    hosts.ts                       # parse host → { kind, slug | hostname }
    tenant.ts                      # resolve custom domains (cached), reserved slugs
    session/                       # seal/unseal, cookie names, refresh, getSession()
    api/                           # backendFetch (server), apiFetch (browser), ApiError
    permissions.ts                 # can(), <Can>
    format.ts                      # money, numbers, dates (Bangla numerals, lakh)
    safe-next.ts                   # same-host `next` validation
  api/                             # typed endpoint functions + query hooks per resource
  features/
    auth/                          # login form, activate form, password fields, errors
    dashboard/                     # widgets for admin/teacher/accountant
    onboarding/                    # wizard steps
  components/
    layout/                        # app-sidebar, header, user menu, school switcher
    form/                          # react-hook-form + Field glue
  i18n/  messages/{en,bn}.json
```

The existing `components/ui`, `components/brand`, `theme-provider`, `theme-toggle` and `hooks/use-mobile.ts` stay where they are.

### 2.3 Dependencies to add

| Package | Use |
| ------- | --- |
| `@tanstack/react-query` (+ devtools) | Server state |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Forms |
| `jose` | Sealing the session cookie (JWE) |
| `next-intl` | Bangla/English without locale routing |
| `nuqs` | URL state for list filters (needed from the first list page) |
| `zustand` | Small client state (sidebar, selected child) |
| `@date-fns/tz` | Asia/Dhaka and school time zone |
| `vitest`, `@testing-library/react`, `@playwright/test` | Tests |

Toasts use the Base UI toast already in `components/ui/toast.tsx` instead of sonner, so there is one primitive layer. The generated OpenAPI client (`frontend-architecture.md` 3.7) is deferred: this slice touches about 25 endpoints, which are written by hand in `src/api/` with types matching the backend DTOs. The generator is evaluated before the feature screens start (section 8).

---

## 3. Host routing (`src/proxy.ts`)

Read `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and the `proxy` file-convention reference before writing it.

Steps, in order:

1. **Skip** `/_next`, static files, `/api/*` and the metadata images (matcher).
2. **Classify the host** with `lib/hosts.ts`, using `NEXT_PUBLIC_ROOT_DOMAIN` (`lvh.me` in dev):
   - apex, `www.` or `localhost` → `site`;
   - `admin.` → `admin`;
   - `<slug>.` → `school` with that slug; a reserved slug → 404;
   - anything else → custom domain: `GET /public/organizations/resolve?host=` (in-memory cache, 60 s, negative results cached too). Unknown → 404 page.
3. **Old slugs**: if `by-slug` reports `movedFrom`, or the backend answered 410 `TENANT_MOVED`, 301 to the current slug on the same path.
4. **Block internal segments**: a request whose path starts with `/site`, `/admin` or `/school` gets 404.
5. **Gates** (school and admin trees only), read from the session cookie without calling the backend:
   - no session on a protected path (`/dashboard`, `/student`, `/onboarding`, `/change-password`, `/setting-up`) → `/login?next=<path>`;
   - `mustChangePassword` → only `/change-password` and `/auth/*` are allowed;
   - signed in and on `/login` → home for the user (section 4.5).
   - The onboarding gate needs `onboardingCompletedAt`, which is in the session snapshot (set at sign-in, updated by `POST /onboarding/complete|skip`). Admins with it null → `/onboarding`; other staff → `/setting-up`.
6. **Rewrite** to `/<tree><path>` and pass `x-host-kind`, `x-tenant-slug` and `x-forwarded-host` as request headers, which server code reads through `headers()`.

Primary-domain redirect (subdomain → custom domain) is left for the Settings → Domain work; the proxy gets a hook for it.

---

## 4. Session layer and BFF

### 4.1 Cookie

- Name `kampasy_session` on school hosts, `kampasy_admin` on the admin host. Host-only (no `Domain`), `HttpOnly`, `Secure` outside dev, `SameSite=Lax`, `Path=/`, `Max-Age` = `refresh_expires_at`.
- Payload, sealed with `jose` `EncryptJWT` (`dir` + `A256GCM`, key from `SESSION_SECRET`): `{ at, rt, atExp, realm: 'tenant' | 'platform', orgId, slug, user: { id, name, email, phone, roles, isAdmin }, mustChangePassword, onboardingCompletedAt }`. Keep it under 4 KB; it holds no permission list (that comes from the query in 5.2).
- `lib/session/` exposes `getSession()` (server components, route handlers, proxy), `setSession(res, tokens)`, `clearSession(res)`, and `updateSession(patch)`.
- The cookie is also bound to the org: `getSession()` ignores a cookie whose `slug`/`orgId` doesn't match the host's tenant. The backend refuses it anyway (`JwtStrategy`).

### 4.2 Sign-in

Login, activate, reset-password-then-login and change-password are **server actions** in `features/auth/actions.ts` (progressive enhancement, no tokens in the browser). Each one:

1. calls the backend with `x-tenant-id: <slug>` and the client's IP in `x-forwarded-for` (the backend trusts the Next server as a proxy; set `TRUST_PROXY` accordingly);
2. on success, seals the cookie and `redirect()`s to the safe `next` or the home for the user;
3. on failure, returns `{ code, message, fieldErrors }` mapped from the backend error envelope.

Handoff is a **route handler** (`school/auth/handoff/route.ts`, `admin/auth/handoff/route.ts`) because it is a top-level GET navigation: redeem `?code`, set the cookie, 303 to the same-host `next`; on any failure → `/login?error=handoff`.

### 4.3 BFF proxy (`app/api/[...path]/route.ts`)

- Accepts all methods, forwards to `${API_URL}/api/<path>?<query>` with `Authorization: Bearer <at>`, `x-tenant-id`, `x-request-id`, `x-forwarded-for` / `x-forwarded-host`, `accept-language`. Streams request and response bodies (uploads and PDF downloads) and passes `Content-Disposition` through.
- Only paths on an allow-list prefix are forwarded from a school host (everything tenanted plus `public/*`); `platform/*` is forwarded only from the admin host.
- CSRF: mutating requests must carry `x-requested-with: kampasy` (the browser client adds it) and a same-origin `Origin`.
- **Refresh**: if `atExp` is within 60 s, or the backend answers 401 (other than `SESSION_REVOKED`), call `POST /auth/refresh` once, rewrite the cookie and retry. Concurrent requests for one session share one in-flight refresh (a `Map<sessionId, Promise>` in the server process). Refresh tokens rotate and a reused one revokes the whole sign-in, so if two server instances ever race, the loser gets 401 and the user signs in again; with sticky sessions or one instance this does not happen. Revisit before scaling out (a short Redis lock).
- 401 after refresh, or `SESSION_REVOKED` → clear the cookie and return 401 with `code: 'SESSION_EXPIRED'`; the browser client sends the user to `/login?next=…`.
- Server components call `backendFetch()` from `lib/api/server.ts` directly (same headers, same refresh, writes the cookie only where allowed: in actions and route handlers; a server component that finds an expired token redirects through `/api/session/refresh?next=`).

### 4.4 Browser client

`lib/api/client.ts`: `apiFetch<T>(path, init)` on relative `/api`, adds `x-requested-with`, unwraps `{ success, data, meta }`, throws `ApiError { status, code, message, details }`. Paginated calls return `{ items, meta }`. One `QueryClient` per browser tab in `components/query-provider.tsx` (retry off for 4xx, `staleTime` 30 s, refetch on focus).

### 4.5 Home for the user

After sign-in or when a signed-in user opens `/` or `/login`:

| Condition | Goes to |
| --------- | ------- |
| `mustChangePassword` | `/change-password` |
| school admin and `onboardingCompletedAt` null | `/onboarding` |
| staff and `onboardingCompletedAt` null | `/setting-up` |
| roles contain only `guardian` / `student` | `/student` |
| everyone else | `/dashboard` |
| platform realm | admin host `/` |

`next` wins over this table when it is a same-host path the user may open (`lib/safe-next.ts`: starts with one `/`, no `//`, no scheme, not `/auth/handoff`).

---

## 5. Screens

### 5.1 School host: auth pages

All share `school/(auth)/layout.tsx`: school logo and name from `GET /public/organizations/:slug/home`, language and theme switch, link back to the school home. Forms are react-hook-form + zod with `components/ui/field.tsx`, work at 360 px, and have labelled inputs and visible errors.

| Page | Behavior |
| ---- | -------- |
| `/` | Public school home: name, logo, contact, public notices, "Sign in" button. |
| `/login` | One form for staff, students and guardians: "Email or phone" + password, show/hide toggle, "Forgot password", "Continue with Google" (hidden when `start` answers 404 `GOOGLE_SIGNIN_DISABLED`; checked once on the server and cached). Messages per code: `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` (shows the unlock time), `ACCOUNT_PENDING`, `MEMBERSHIP_PENDING` (point to the invitation link), `?error=handoff`, `?error=google_no_account`. |
| `/activate?token=` | `GET /auth/activate` first: invalid/expired token → explain and offer "Ask your school to resend". `hasPassword` false → set password + confirm; true → "Enter your existing password". Then signed in like login. |
| `/forgot-password` | Email field; always the same confirmation text. |
| `/reset-password?token=` | Check token, then new password + confirm; on success → `/login` with a toast. |
| `/verify-email?token=` | Check, verify, show result. |
| `/change-password` | Forced (after a slip password) or voluntary. Current + new + confirm. On success the session snapshot drops `mustChangePassword`. |
| `/setting-up` | "Your school is being set up" for staff while onboarding is open; sign-out button. |
| `/auth/handoff` | Route handler (4.2). |

Password rules match the backend DTOs (read `activate.dto.ts`, `reset-password.dto.ts`); keep them in one zod schema in `features/auth/schemas.ts`.

### 5.2 Apex: signup and find school

| Page | Behavior |
| ---- | -------- |
| `/signup` | School name, type, slug (suggested from the name, live check through `GET /public/slugs/check`, debounced), owner name, email, phone, password; or "Sign up with Google" (`intent=signup`, the form continues with the verified email and `googleTicket`). `verification_sent` → "Check your email" screen with resend. `created` → `window.location = redirectUrl`. |
| `/signup/verify?token=` | `POST /public/signup/verify` → follow `redirectUrl` (lands on the school's `/auth/handoff` → `/onboarding`). |
| `/find-school` | Two panels: "Enter your email" (`POST /public/find-school`, same answer always) and "Enter your school's address" (`____.mydomain.com`, checks `by-slug` and redirects to `/login`). |

Update `app/site/_landing/links.ts` (`SIGNUP_HREF = "/signup"`) once these exist.

### 5.3 Onboarding (`/onboarding`)

A stepper over `GET /onboarding/checklist` (steps `profile`, `session`, `classes`, `curriculum` required; `grading`, `fees`, `staff`, `students` optional), with progress from `percentage`. In this slice each step shows its status and the template actions the backend already offers (`GET /onboarding/templates`, apply curriculum/grading/fee heads/BD holidays); steps that need a full feature screen (profile settings, session, classes) get a minimal form or a link to the screen once it exists. "Finish" is enabled by `canComplete` (`POST /onboarding/complete`); "Skip for now" calls `POST /onboarding/skip`. Both update `onboardingCompletedAt` in the cookie and go to `/dashboard`.

### 5.4 Staff app shell (`/dashboard/*`)

- `dashboard/layout.tsx` (server): reads the session, prefetches `GET /auth/me` (with `permissions`) and `GET /settings/display`, and hydrates them into TanStack Query.
- **Sidebar** (`components/layout/app-sidebar.tsx`, on `components/ui/sidebar.tsx`): the menu from `example-menu-frontend.md`, trimmed to what the MVP backend covers (Dashboard, Academics, People, Attendance, Exams, Fees, Notices, Administration, Settings). Items declare `permission` (and later `module`) instead of role names; `lib/permissions.ts` filters them. A menu with no visible children is hidden, and so is an empty category. Collapses to icons on desktop and to a sheet at mobile width. Includes search over menu labels.
- **Header**: breadcrumb from the route, notification bell (`GET /notifications/unread-count`, polled every 60 s; dropdown with the latest and "Mark all read"), language switch, theme toggle, user menu (name, roles, "Account", "Sign out", "Sign out everywhere").
- **School switcher**: in the user menu, lists the user's other schools (`GET /portal/schools` for portal users; for staff, a platform-session-free list needs a backend endpoint later) and moves between them with a handoff. Ships after the rest if the endpoint is not there.
- **Branding**: the school logo and primary color from `settings/display` become CSS variables on the shell.
- **Unbuilt links**: `dashboard/[...slug]/page.tsx` shows a "Coming soon" empty state with the page title, so nothing 404s.
- **Account** (`/dashboard/account`): profile summary, change password, active sessions (`GET /auth/sessions`, end one), Google link/unlink.

### 5.5 Home dashboard (`/dashboard`)

One page that composes widgets by permission, so a principal who is also an accountant sees both sets:

| Widget group | Shown when | Data |
| ------------ | ---------- | ---- |
| School overview | `dashboard_admin:read` | `GET /dashboards/admin`: enrollment total + by class (bar chart), attendance today (school %, by class, registers submitted vs sections), collection today and month to date, dues totals, active staff, upcoming holidays and exams (30 days) |
| My day | `dashboard_teacher:read` | `GET /dashboards/teacher`: today's sections with register status and a "Take attendance" action, pending attendance count, pending mark sheets with links |
| Finance | `dashboard_accountant:read` | `GET /dashboards/accountant`: collection today / month, dues, expenses month to date, recent payments table |
| Onboarding banner | admin and checklist below 100 % | `GET /onboarding/checklist` |
| Empty state | none of the above | Welcome text and links to the user's permitted menus |

Rules: each group is its own client component with its own query, skeleton and error state, so one failing endpoint doesn't blank the page. Stat tiles and charts follow the `dataviz` guidance and the design system tokens; money goes through `lib/format.ts` (`৳`, lakh grouping, Bangla digits when the locale is `bn`). The backend caches dashboards for 60 s, so the client `staleTime` is 60 s too. At 360 px tiles stack in one column and charts become lists.

### 5.6 Portal shell (`/student/*`)

Minimal in this slice: layout with a child picker (`GET /portal/children`), a home page with the child's summary (`GET /portal/children/:id/dashboard`) and sign-out. The rest of the portal is a later slice.

### 5.7 Admin host

`/login` (platform realm, `POST /platform/auth/login`), `/auth/handoff` (`POST /platform/auth/handoff/exchange`, used by Google), and a shell with a placeholder home. Platform screens (schools, plans, users, audit) are a later slice. "Open school" (issue a school handoff and redirect) goes in with the schools list.

---

## 6. Cross-cutting

- **i18n**: `next-intl` without routing. Locale from a `locale` cookie, then the school's `settings/display` locale, then `bn`. `messages/en.json` and `messages/bn.json` hold every string in this slice; no hard-coded UI text.
- **Formatting** (`lib/format.ts`): `formatMoney(minorUnits)` (the backend sends `bigint` minor units as strings), `formatNumber`, `formatDate` in the school time zone; unit-tested.
- **Errors**: `app/school/dashboard/error.tsx` and `not-found.tsx`; `ApiError.code` → message map in `features/auth/errors.ts` and a generic fallback. `PASSWORD_CHANGE_REQUIRED` from any call → `/change-password`.
- **Security**: no tokens in browser JS or `localStorage`; `safeNext` on every redirect; CSP and security headers in `next.config.ts`; the BFF never forwards the browser's own `Authorization` or `cookie` headers.
- **Env** (`web-2/.env.example`): `API_URL` (server-only, e.g. `http://localhost:3900`), `NEXT_PUBLIC_ROOT_DOMAIN` (`lvh.me`), `NEXT_PUBLIC_ADMIN_HOST`, `SESSION_SECRET` (32+ bytes), `NEXT_PUBLIC_APP_PORT`. Validate at boot with zod in `lib/env.ts`.
- **Backend config**: set `APP_URL`/host settings so signup and Google `redirectUrl`s point at `lvh.me:3000` hosts, and add `http://*.lvh.me:3000` to `CORS_ORIGIN` only if a browser ever calls the API directly (it shouldn't).

---

## 7. Milestones

Tick a box only when the item is merged to `main` and works against the local docker-compose stack. Every milestone also ends with the **exit checks**: `npm run lint`, `npm run typecheck` and `npm run build` pass in `web-2/`, and its "Done when" scenarios have been tried by hand.

| # | Milestone | Depends on | Status |
| - | --------- | ---------- | ------ |
| MB | Backend prerequisites | — | In progress (B1 done) |
| M0 | Foundations | — | Not started |
| M1 | Host routing | M0 | Not started |
| M2 | Session layer and BFF | M1 | Not started |
| M3 | School sign-in | M2 | Not started |
| M4 | Signup and find school | M3 | Not started |
| M5 | Staff app shell | M3, B1 | Not started |
| M6 | Home dashboards | M5 | Not started |
| M7 | Onboarding wizard | M5 | Not started |
| M8 | Portal and admin shells | M3 | Not started |
| M9 | Hardening | M3–M8 | Not started |

M1–M3 are the critical path. M4, M5 and M8 can run in parallel once M3 is merged; M6 and M7 once M5 is.

### MB. Backend prerequisites

- [x] B1: `GET /auth/me` returns `permissions: string[]` (`RoleService.effectivePermissions`; school admins get the whole catalog; retired keys left out).
- [x] B1 tests: unit (`role.service.spec.ts`) and e2e (`test/auth-sessions.e2e-spec.ts`).
- [ ] B1 committed.
- [ ] B2: plan modules and trial state (`modules`, `plan`, `trialEndsAt`) on `GET /auth/me` or `GET /settings/display`, with tests.
- [ ] B3: short access-token TTL (`JWT_EXPIRES_IN=15m`) in `.env.example` and the deployment env; confirm refresh works with it.
- [ ] Endpoint listing a staff member's other schools for the school switcher (open question in section 10), or a decision to defer it.
- [ ] Backend host settings for dev (`APP_URL`, root domain `lvh.me`) so signup and Google `redirectUrl`s point at `*.lvh.me:3000`.
- [ ] `TRUST_PROXY` includes the Next server, so the client IP the BFF forwards is used for audit rows and rate limits.

**Done when:** `GET /auth/me` for an admin, a teacher and a guardian returns the expected `permissions`, and signup's `redirectUrl` points at the dev school host.

### M0. Foundations

Packages and config:

- [ ] Runtime deps: `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `jose`, `next-intl`, `nuqs`, `zustand`, `@date-fns/tz`.
- [ ] Dev deps: `@tanstack/react-query-devtools`, `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@playwright/test`.
- [ ] Scripts: `test` (Vitest) and `test:e2e` (Playwright); `typecheck` exists.
- [ ] `vitest.config.ts` with the `~/*` alias and jsdom; `playwright.config.ts` with a 360 px and a desktop project, `baseURL` on `lvh.me:3000`.
- [ ] `web-2/.env.example`: `API_URL`, `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_ADMIN_HOST`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_PORT`.
- [ ] `lib/env.ts`: zod-validated env; server-only values kept out of client bundles (`server-only` import).

Shared code:

- [ ] `lib/api/errors.ts`: `ApiError { status, code, message, details }` and `toApiError(body, status)`.
- [ ] `lib/api/envelope.ts`: unwrap `{ success, statusCode, message, data, meta }`; paginated results as `{ items, meta }`.
- [ ] `lib/api/client.ts`: `apiFetch<T>()` on relative `/api`, adds `x-requested-with: kampasy`, JSON and `FormData` bodies.
- [ ] `components/query-provider.tsx`: one `QueryClient` per tab (`staleTime` 30 s, no retry on 4xx, refetch on focus), devtools in dev only; wired into `app/layout.tsx`.
- [ ] `lib/format.ts`: `formatMoney` (minor units as string or bigint, `৳`, lakh grouping), `formatNumber`, `formatDate` / `formatDateTime` in a given time zone, Bangla digits when the locale is `bn`.
- [ ] `lib/safe-next.ts`: same-host path check (one leading `/`, no `//`, no scheme, not `/auth/handoff`).

i18n:

- [ ] `next-intl` without routing: `i18n/request.ts` reads the `locale` cookie (fallback `bn`); `messages/en.json` and `messages/bn.json`.
- [ ] `NextIntlClientProvider` in the root layout; `<html lang>` follows the locale.
- [ ] Language switch component (sets the cookie, refreshes the route).

CI:

- [ ] `web-2` job in `.github/workflows/ci.yml`: install, lint, typecheck, Vitest, build.

Tests:

- [ ] Vitest: formatters (Bangla digits, lakh grouping, minor units, time zone), envelope unwrap and `ApiError`, `safeNext`.

**Done when:** the app builds and runs as before (landing unchanged), `npm test` passes, and the CI job is green.

### M1. Host routing

- [ ] Read `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and the `proxy` file-convention reference.
- [ ] `lib/hosts.ts`: `classifyHost(host)` → `{ kind: 'site' | 'admin' | 'school' | 'custom', slug?, hostname }`; strips the port, lower-cases, handles `localhost`, `www.`, `admin.` and reserved slugs.
- [ ] Reserved-slug list kept in sync with `backend/src/shared/slug/reserved-slugs.ts` (copied with a pointer comment, or read from `GET /public/slugs/reserved`).
- [ ] `lib/tenant.ts`: `resolveCustomDomain(host)` through `GET /public/organizations/resolve?host=`, 60 s in-memory cache, negative results cached.
- [ ] Old slugs: `by-slug` `movedFrom` or 410 `TENANT_MOVED` → 301 to the current slug, same path and query.
- [ ] `src/proxy.ts` matcher skips `/_next`, static files, `/api/*` and metadata images.
- [ ] `src/proxy.ts` rewrites to `/site`, `/admin` or `/school` + path and sets `x-host-kind`, `x-tenant-slug`, `x-forwarded-host` request headers.
- [ ] `src/proxy.ts` answers 404 for `/site/*`, `/admin/*`, `/school/*` requested directly.
- [ ] Unknown school or custom host → a "School not found" page linking to `/find-school` on the apex.
- [ ] `lib/request-tenant.ts`: server helper reading `x-host-kind` / `x-tenant-slug` through `headers()`.
- [ ] Move `app/page.tsx` and `app/_landing/` to `app/site/`, and `app/design-system/` to `app/site/design-system/`.
- [ ] Placeholder `app/admin/page.tsx` and `app/school/page.tsx` (school name from `GET /public/organizations/:slug/home`).
- [ ] Hook in the proxy for the primary-domain redirect (no-op for now).

Tests:

- [ ] Vitest: `classifyHost` for apex, `www`, `localhost`, `admin`, slug, reserved slug, custom domain, host with port, upper case.

**Done when:** `lvh.me:3000` shows the landing, `acme.lvh.me:3000` the school placeholder with the school's name, `admin.lvh.me:3000` the admin placeholder, an unknown slug the "School not found" page, and `/school/login` typed directly gives 404.

### M2. Session layer and BFF

Session:

- [ ] `lib/session/seal.ts`: `seal(payload)` / `unseal(token)` with `jose` (`dir`, `A256GCM`, key derived from `SESSION_SECRET`), expiry checked.
- [ ] `lib/session/cookie.ts`: cookie names (`kampasy_session`, `kampasy_admin`) and options (host-only, `HttpOnly`, `Secure` outside dev, `SameSite=Lax`, `Path=/`, `Max-Age` from `refresh_expires_at`).
- [ ] `lib/session/index.ts`: `getSession()`, `setSession(tokens)`, `updateSession(patch)`, `clearSession()`; a cookie whose `slug` doesn't match the host's tenant counts as no session.
- [ ] `fromTokenResponse(body)` maps the backend token response to the session payload (section 4.1); payload stays under 4 KB.

Backend calls:

- [ ] `lib/api/server.ts`: `backendFetch()` for server components, actions and route handlers; adds `Authorization`, `x-tenant-id`, `x-request-id`, `x-forwarded-for`, `x-forwarded-host`, `accept-language`.
- [ ] `lib/session/refresh.ts`: refresh when `atExp` is within 60 s or on 401; one in-flight refresh per session (`Map<sessionId, Promise>`); `SESSION_REVOKED` or a failed refresh clears the session.
- [ ] `/api/session/refresh?next=` route handler for server components that find an expired access token (they can't write cookies).

BFF:

- [ ] `app/api/[...path]/route.ts`: all methods; forwards to `${API_URL}/api/<path>?<query>`; streams request and response bodies; passes `Content-Type`, `Content-Disposition`, `Cache-Control`.
- [ ] Path allow-list: tenant paths and `public/*` from school hosts, `platform/*` only from the admin host, only `public/*` from the apex.
- [ ] CSRF: mutating requests need `x-requested-with: kampasy` and a same-origin `Origin`, otherwise 403.
- [ ] Never forwards the browser's own `cookie` or `Authorization` headers.
- [ ] 401 after refresh → clear the cookie and answer 401 `SESSION_EXPIRED`; `apiFetch` then sends the user to `/login?next=<current path>`.
- [ ] Logout: `POST /api/session/logout` (backend `POST /auth/logout`, then clear the cookie); "Sign out everywhere" through `POST /auth/logout-all`.

Tests:

- [ ] Vitest: seal/unseal round trip, tampered and expired tokens, refresh dedupe (two concurrent calls → one backend refresh), path allow-list, payload size.

**Done when:** with a session set by hand, a client component reads `/api/auth/me` through the BFF; with the access token expired, the next call refreshes silently; logout clears the cookie and ends the backend session (`GET /auth/sessions` no longer lists it).

### M3. School sign-in

Layout and shared parts:

- [ ] `app/school/(auth)/layout.tsx`: centered card, school logo and name, language and theme switch, link to the school home.
- [ ] `features/auth/schemas.ts`: zod schemas for the identifier, password rules matching the backend DTOs, and confirm-password match.
- [ ] `features/auth/errors.ts`: en/bn message per code: `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` (with the unlock time), `ACCOUNT_PENDING`, `MEMBERSHIP_PENDING`, `SESSION_REVOKED`, `PASSWORD_CHANGE_REQUIRED`, invalid or expired token, `handoff`, `google_no_account`, and a fallback.
- [ ] `components/form/`: react-hook-form glue on `components/ui/field.tsx`, password input with show/hide, submit button with pending state; field errors from the server mapped onto fields.
- [ ] `lib/session/home.ts`: home for the user (section 4.5), combined with `safeNext`.

Pages and handlers:

- [ ] `/login`: email-or-phone + password server action, message per error code, "Forgot password" link, keeps `next`.
- [ ] "Continue with Google" on `/login`: links to `/oauth/google/start?return=<host>&next=<next>&intent=signin`; hidden when Google is disabled (checked on the server, cached).
- [ ] `/auth/handoff` route handler: redeem `code` (`POST /auth/handoff`), set the session, 303 to the safe `next` or home; any failure → `/login?error=handoff`.
- [ ] `/activate?token=`: check the token; set-password form, or "enter your existing password" when `hasPassword`; signed in on success; clear message for an invalid or used link.
- [ ] `/forgot-password`: email form, same confirmation whatever the result.
- [ ] `/reset-password?token=`: check the token, new password + confirm, then `/login` with a toast.
- [ ] `/verify-email?token=`: check and verify, show the result.
- [ ] `/change-password`: forced and voluntary modes; on success `mustChangePassword` is cleared in the session.
- [ ] `/setting-up`: "Your school is being set up", with a sign-out button.
- [ ] School home `/`: public notices and contact from `GET /public/organizations/:slug/home`; "Sign in" button, or "Go to dashboard" when signed in.

Gates in `src/proxy.ts`:

- [ ] No session on `/dashboard`, `/student`, `/onboarding`, `/change-password`, `/setting-up` → `/login?next=…`.
- [ ] `mustChangePassword` → only `/change-password` and sign-out allowed.
- [ ] Onboarding open: admins → `/onboarding`, other staff → `/setting-up`; portal users unaffected.
- [ ] Signed in on `/login` → home for the user.
- [ ] `PASSWORD_CHANGE_REQUIRED` from any BFF call → `/change-password`.

Tests:

- [ ] Component: the login form shows the right message per error code; the activate form renders both branches.

**Done when:** these work by hand against seeded data: the owner signs in with email and with phone; five wrong passwords show the lockout time; an invited teacher activates from the Mailpit email and lands on `/dashboard`; a guardian with a slip password is forced to change it, then lands on `/student`; the forgot/reset password round trip works; a reused handoff code ends on `/login?error=handoff`.

### M4. Signup and find school

- [ ] `/signup` form: school name, type, slug, owner name, email, phone, password.
- [ ] Slug suggested from the school name; an edited slug is checked live (`GET /public/slugs/check`, debounced) and shows why it is taken or reserved.
- [ ] Submit `POST /public/signup`: `verification_sent` → "Check your email" with resend; `created` → go to `redirectUrl`.
- [ ] "Sign up with Google" (`intent=signup`): the form continues with the verified email and `googleTicket`, without a password field.
- [ ] `/signup/verify?token=`: `POST /public/signup/verify`, then go to `redirectUrl` (school `/auth/handoff` → `/onboarding`); clear message for an invalid or used link.
- [ ] `/find-school` "Enter your email": `POST /public/find-school`, same confirmation always.
- [ ] `/find-school` "Enter your school's address": `____.<root domain>` input, checked with `GET /public/organizations/by-slug`, redirects to that school's `/login`.
- [ ] Landing links: `SIGNUP_HREF = "/signup"`, `FIND_SCHOOL_HREF = "/find-school"`; the header's "Sign in" goes to `/find-school`.

**Done when:** a new school is created from the apex, the owner verifies through Mailpit and lands signed in on `<slug>.lvh.me:3000/onboarding`; "Find your school" by email sends the list of schools.

### M5. Staff app shell

Layout and data:

- [ ] `app/school/dashboard/layout.tsx`: requires a staff session; prefetches `GET /auth/me` and `GET /settings/display` on the server and hydrates TanStack Query.
- [ ] `api/auth.ts` hooks: `useMe()` (refetch on focus) and `useDisplaySettings()`.
- [ ] `lib/permissions.ts`: `can(key)`, `canAny(keys)` and `<Can permission>`; school admins pass everything.
- [ ] Branding: logo and primary color from `settings/display` as CSS variables on the shell.

Sidebar:

- [ ] `config/nav.ts`: categories → menus → items, each with a label key, icon, href and `permission` (later `module`), covering the MVP areas (Dashboard, Academics, People, Attendance, Exams, Fees, Notices, Administration, Settings).
- [ ] `components/layout/app-sidebar.tsx` on `components/ui/sidebar.tsx`: filters by `can()`, hides empty menus and categories, highlights the active path.
- [ ] Collapses to icons on desktop and becomes a sheet at mobile width; the collapsed state is remembered (cookie).
- [ ] Menu search over labels in the active locale.

Header:

- [ ] Breadcrumb from the route segments and nav labels.
- [ ] Notification bell: `GET /notifications/unread-count` every 60 s; dropdown with the latest from `GET /notifications`; mark one read and "Mark all read".
- [ ] Language switch and theme toggle.
- [ ] User menu: name, roles, "Account", "Sign out", "Sign out everywhere".

Pages:

- [ ] `dashboard/[...slug]/page.tsx`: "Coming soon" empty state titled from the nav label.
- [ ] `dashboard/error.tsx` and `dashboard/not-found.tsx`.
- [ ] `/dashboard/account`: profile summary, change password, active sessions (`GET /auth/sessions`, end one with `DELETE /auth/sessions/:id`), Google link/unlink.

Tests:

- [ ] Vitest: nav filtering for an admin, a teacher, an accountant and a member with no keys.

**Done when:** a teacher sees only the menus their keys allow and an admin sees all of them; removing a key from a role hides its menu after the window regains focus; the shell works at 360 px; the bell count updates after a notice is published.

### M6. Home dashboards

- [ ] `api/dashboards.ts`: `useAdminDashboard`, `useTeacherDashboard`, `useAccountantDashboard`, each enabled only when `can()` allows it, `staleTime` 60 s, with types matching `DashboardService`.
- [ ] `features/dashboard/stat-tile.tsx` and chart wrappers on `components/ui/chart.tsx`, following the `dataviz` guidance and the design tokens.
- [ ] **School overview** (`dashboard_admin:read`): enrollment total and by class, attendance today (school %, by class, registers submitted vs sections), collection today and month to date, dues totals, active staff, upcoming holidays and exams.
- [ ] **My day** (`dashboard_teacher:read`): today's sections with register status and a "Take attendance" link, pending attendance count, pending mark sheets with links.
- [ ] **Finance** (`dashboard_accountant:read`): collection today and month to date, dues, expenses month to date, recent payments.
- [ ] Onboarding banner for admins while the checklist is below 100 % (`GET /onboarding/checklist`), linking to `/onboarding`.
- [ ] Empty state for users with none of the dashboard keys: welcome text and links to the menus they can open.
- [ ] Each group has its own skeleton and its own error state with retry; one failing doesn't affect the others.
- [ ] Money and numbers through `lib/format.ts`; dates in the school time zone.
- [ ] At 360 px tiles stack in one column and charts fall back to lists.

**Done when:** on a seeded school, the admin, teacher and accountant each see their groups with real numbers; a principal who is also an accountant sees both; with one dashboard endpoint failing, the others still render.

### M7. Onboarding wizard

- [ ] `app/school/onboarding/layout.tsx`: its own layout (no sidebar) with a progress bar from `percentage`.
- [ ] Stepper over `GET /onboarding/checklist`: required steps (`profile`, `session`, `classes`, `curriculum`) and optional ones (`grading`, `fees`, `staff`, `students`), each with its done state.
- [ ] Template actions from `GET /onboarding/templates`: apply curriculum, grading, fee heads and BD holidays; the checklist is refetched after each.
- [ ] Minimal forms for profile, session and classes (or links to the feature screens once they exist).
- [ ] "Finish", enabled by `canComplete`, calls `POST /onboarding/complete`; "Skip for now" calls `POST /onboarding/skip`.
- [ ] After either, `onboardingCompletedAt` is updated in the session and the user goes to `/dashboard`.

**Done when:** a new owner works through the required steps and finishes, or skips; either way they land on `/dashboard`, and that school's staff no longer see `/setting-up`.

### M8. Portal and admin shells

Portal (`/student`):

- [ ] Layout with a child picker (`GET /portal/children`); the selected child is kept in the URL.
- [ ] Home: the child's summary from `GET /portal/children/:id/dashboard`.
- [ ] Sign-out, and "Other schools" from `GET /portal/schools`, moving with `POST /portal/handoff`.
- [ ] Mobile-first layout (bottom navigation at 360 px).

Admin host:

- [ ] `/login` (platform realm, `POST /platform/auth/login`), session in the `kampasy_admin` cookie.
- [ ] `/auth/handoff` route handler (`POST /platform/auth/handoff/exchange`) for Google sign-in.
- [ ] Shell with a placeholder home and sign-out; school hosts never accept the platform cookie.

**Done when:** a guardian with two children switches between them and, with children at two schools, moves to the other school without signing in again; a super-admin signs in on `admin.lvh.me:3000`.

### M9. Hardening

- [ ] Playwright suites from section 9, at 360 px and desktop, against the docker-compose stack (emails read through the Mailpit API).
- [ ] Playwright job in CI (Postgres, Redis and Mailpit services, backend and web-2 started).
- [ ] Bangla pass: every string in `messages/bn.json`, no hard-coded UI text (lint rule or check script).
- [ ] Accessibility: axe checks in Playwright on every page of this slice; keyboard-only sign-in and navigation; contrast checked in both themes.
- [ ] Performance: 3G throttling on login and `/student`; bundle analyzer report with auth and portal routes within ~150 KB gzipped JS.
- [ ] Security headers and CSP in `next.config.ts`; confirm no token appears in client JS, `localStorage` or HTML.
- [ ] `frontend-architecture.md` and this doc updated with whatever changed during the build.

**Done when:** every section 9 suite is green in CI, and the axe and bundle checks pass.

---

## 8. Decisions for this slice

- **Hand-written API layer now, generator later.** Before the feature screens, generate the client from `/api/docs` with orval and with hey-api, compare, and migrate `src/api/` to the winner (`frontend-architecture.md` 11).
- **Server actions for credential forms, route handlers for redirects and the BFF.** Tokens never leave the server.
- **Permission-based gating, not role names.** The old frontend gated by role name (`example-menu-frontend.md`); custom roles make that wrong, so every menu item and widget declares a permission key from `permissions.catalog.ts`.
- **Base UI toast** instead of sonner (already wired in the root layout).
- **Separate CI job** for `web-2` (lint, typecheck, build, Vitest), added to `.github/workflows/ci.yml` in M0; Playwright joins in M9 against the docker-compose stack.

---

## 9. Tests

| Level | What |
| ----- | ---- |
| Unit (Vitest) | `hosts.ts` classification (apex, admin, slug, reserved, custom, ports), `safeNext`, session seal/unseal and expiry, envelope unwrap and `ApiError`, `can()` and sidebar filtering, formatters (Bangla digits, lakh grouping, minor units) |
| Component | Login form error mapping per code, activate form both branches, sidebar with different permission sets, dashboard widget error isolation |
| E2E (Playwright, 360 px and desktop) | Owner signup → onboarding → dashboard; login with email and with phone; lockout message; activation from an invite email (Mailpit API); forced password change; session cookie from school A refused on school B; handoff code reused → `/login?error=handoff`; logout and "sign out everywhere"; teacher vs admin sidebar and dashboard; guardian lands on `/student` |

---

## 10. Open questions

- Should a staff user who belongs to several schools get a school switcher in this slice? It needs a tenant endpoint listing the user's schools (today only `GET /portal/schools` and `GET /memberships/me` exist; check whether the latter fits).
- Should `/` on a school host redirect signed-in users to their home, or always show the public page with a "Go to dashboard" button? This plan assumes the button.
- Access-token TTL (B3) and whether refresh needs a shared lock before running more than one frontend instance.
