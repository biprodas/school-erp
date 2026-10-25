# web-2

The School ERP frontend: one Next.js 16 app (App Router, React 19, React Compiler) that serves the marketing site, every school's host, and the platform admin host. The stack and the reasons for it are in `../doc/frontend-architecture.md`; hosts, handoff and Google sign-in in `../doc/domains-and-routing.md`.

## Commands

```bash
cp .env.example .env.local   # API_URL, SESSION_SECRET, NEXT_PUBLIC_ROOT_DOMAIN, …
npm run dev                  # http://lvh.me:3000, http://<slug>.lvh.me:3000, http://admin.lvh.me:3000
npm run build
npm run lint                 # includes the folder boundary rules below
npm run typecheck
npm run format               # format:check in CI
npm test                     # Vitest, src/**/*.test.{ts,tsx}
npm run test:e2e             # Playwright against the docker-compose stack and a running backend
npm run analyze              # bundle report per route
```

shadcn components: `npx shadcn@latest add <name>` writes to `src/components/ui`. Imports use the `~/` alias (`~/components/ui/button`).

## Folder structure

```
src/
├── proxy.ts            # host → internal tree rewrite, session refresh, sign-in and onboarding gates
├── app/                # routing only: pages, layouts, route handlers, error/not-found
│   ├── site/           # apex host: landing, signup, find-school, design-system
│   ├── admin/          # admin host: platform console
│   ├── school/         # every school host (subdomain or custom domain)
│   │   ├── (auth)/     # login, activate, forgot/reset password, verify email, …
│   │   ├── onboarding/ # setup wizard
│   │   ├── dashboard/  # staff app (admin, principal, teacher, accountant, …)
│   │   └── student/    # family portal (guardians and students)
│   ├── api/            # BFF: /api/* proxied to the backend with the session's token
│   └── unavailable/  unknown-school/
├── features/           # one folder per domain
├── components/         # domain-free UI
│   ├── ui/             # shadcn on Base UI (generated; edit sparingly)
│   ├── brand/          # logos and marks
│   ├── forms/          # react-hook-form glue: FormField, PasswordInput, SubmitButton, useActionForm
│   ├── layouts/        # PageHeader, StatusPage
│   ├── providers/      # QueryProvider, ThemeProvider
│   └── common/         # SchoolLogo, InitialsAvatar, LanguageSwitch, ThemeToggle
├── lib/                # domain-free logic
│   ├── api/            # fetch clients: client.ts (browser → BFF), server.ts (server → backend), envelope, ApiError
│   ├── auth/           # sealed session cookie, refresh, sign-in gates, Google probe (server-only)
│   ├── bff/            # the /api proxy handler and its allow rules
│   ├── tenancy/        # host classification, tenant lookup, slugs, request host
│   ├── security/       # CSP and headers, safe redirects, client IP
│   ├── forms/          # zod resolver, server action form state
│   └── format.ts  phone.ts  initials.ts  brand-colors.ts  utils.ts
├── hooks/              # generic React hooks (useIsMobile, useDebouncedValue)
├── config/             # every setting; the only place that reads process.env
├── i18n/               # next-intl request config (catalogs in ../messages)
└── test/               # Vitest setup and fixtures
```

### Features

A feature is a business domain and mirrors the backend module of the same name (`backend/src/modules/<x>`) where there is one. Current: `academics`, `access` (permissions, `usePermissions`, `<Can>`), `account`, `admin`, `auth`, `dashboard`, `marketing`, `notifications`, `onboarding`, `portal`, `school-site`, `settings`, `shell` (staff sidebar and header), `signup`. Domains such as `students`, `attendance`, `exams`, `fees` get a folder when their screens start, not before.

```
features/<domain>/
├── api.ts          # endpoint calls, query keys and queryOptions factories
├── actions.ts      # "use server" actions
├── schemas.ts      # zod schemas (types inferred from them)
├── use-*.ts        # hooks with real logic (not wrappers around one useQuery)
├── components/     # the feature's UI, tests next to them
└── server/         # server-only helpers (import "server-only")
```

A file becomes a folder of the same name (`api/`, `schemas/`, `hooks/`) once it holds too much to read in one go. Feature-only client state (Zustand) goes in the feature as `store.ts`; URL state (filters, the selected child, pages) uses nuqs or search params.

API modules export `queryOptions` factories rather than `use*` hooks: a component calls `useQuery(studentQuery(id))`, and a server component can prefetch the same options. The backend's response envelope is unwrapped by `lib/api`, and errors arrive as `ApiError` with the backend `code`.

### Rules

- **`app/` is routing only.** A page reads params and the session, then renders a feature component. UI used by one route only may stay in a `_private` folder next to it (as the design-system page does).
- **Shared code never imports features or routes.** `components/`, `lib/`, `hooks/`, `config/` and `i18n/` can't import `~/features/*` or `~/app/*`, and features can't import `~/app/*`. ESLint enforces this (`eslint.config.mjs`).
- **Features import each other directly, by file** (`~/features/academics/api`), never through another feature's `server/` or `actions.ts` from client code. There are no `index.ts` barrels: features mix server-only modules, server actions and client components, and one barrel would drag server code into client bundles.
- **Tokens stay on the server.** The browser talks only to the BFF (`/api/*`, `lib/api/client.ts`); server components and actions call the backend through `lib/api/server.ts`.
- **Tenancy comes from the host.** `proxy.ts` resolves the school and passes it in request headers; read it with `getRequestHost()` / `requireSchoolSlug()` (`lib/tenancy/request-host.ts`), never from the URL or the client.
- **Gate UI by permission key, never by role name** (`features/access`). It only hides UI: the backend checks every request.
- **UI text comes from the message catalogs** (`messages/{en,bn,hi}.json`); ESLint refuses literal strings in JSX outside the marketing landing and the design-system page.
- Tests sit next to the code (`*.test.ts(x)`); end-to-end specs are in `e2e/`.
