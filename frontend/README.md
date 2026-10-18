# School ERP — Frontend

Next.js 16 App Router app for the multi-tenant School ERP SaaS. One codebase serves four parts:

- the marketing site
- the platform (super-admin) console
- each school's staff dashboard
- the student portal

Which part a request gets depends on the host it's served from.

> This Next.js version has breaking changes compared with older releases. Read `AGENTS.md` and the guides in `node_modules/next/dist/docs/` before changing framework-level code. For example, middleware lives in `src/proxy.ts`, not `middleware.ts`.

## Quick start

```bash
# Backend must be running on :3900 (see ../backend/README.md)
cp -n .env.example .env.local   # skipped if it exists
npm install
npm run dev
```

| URL | Surface |
|-----|---------|
| http://localhost:3000 or http://lvh.me:3000 | Marketing site + platform admin (`/platform`) |
| http://acme.lvh.me:3000 | Tenant `acme`: staff dashboard (`/dashboard`) and student portal (`/student`) |

`lvh.me` and all of its subdomains resolve to `127.0.0.1`, so tenant subdomains work locally without editing `/etc/hosts`.

## Scripts

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # ESLint
```

There is no test runner yet.

## Environment

See `.env.example`.

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_BASE_API_URL` | Backend base URL, e.g. `http://localhost:3900/api` |
| `NEXT_PUBLIC_APP_URL` | This app's URL |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Platform root domain (`lvh.me` in dev). Its subdomains are tenant slugs |
| `AUTH_SECRET` | NextAuth secret. Generate one with `npx auth secret` |
| `AUTH_TRUST_HOST` | `true`. Required so NextAuth trusts `*.lvh.me` hosts |
| `AUTH_COOKIE_DOMAIN` | `.lvh.me` in dev. Shares the session cookie across subdomains |

**Do not set `AUTH_URL`.** It pins auth callbacks to a single host, which breaks login on tenant subdomains.

## Architecture

### Tenant resolution (`src/lib/tenant.ts`)

- A subdomain of `NEXT_PUBLIC_ROOT_DOMAIN` is a tenant slug (`acme.lvh.me` → `acme`).
- A custom domain is resolved through the backend's public tenant lookup.
- The apex domain or `localhost` is the platform host.

### Auth (`src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`)

- NextAuth v5 has two Credentials providers: one for tenant users and `platform-credentials` for platform admins.
- `proxy.ts` runs the edge-safe `authorized` callback on every route. It sends unauthenticated users to login and redirects each user to the right surface. Students are kept inside `/student/*`, and staff stay out of it.

### API layer

- `src/lib/api/axios.ts` (`createApiClient`):
  - injects the bearer token and the `x-tenant-id` header
  - unwraps the backend's `{ success, statusCode, message, data }` envelope
  - normalizes errors to `ApiError`
- `src/lib/api/client.ts` is the client for the browser. `src/lib/api/server.ts` is the client for React Server Components and server actions.
- `src/lib/api/backend.ts` is a minimal fetch used inside NextAuth `authorize`. It doesn't use the axios interceptors.
- `src/apis/{platform,tenanted}/<resource>/` holds the endpoint functions and TanStack Query hooks for each resource. Query keys live in `src/lib/api/query-keys.ts`.

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/(main)/` | Public marketing / landing pages |
| `src/app/(auth)/` | Login, signup, activate, verify-email, forgot/reset password |
| `src/app/(dashboard)/` | Tenant staff dashboard (`/dashboard`, `/profile`) |
| `src/app/(dashboard)/_components/sidebar-nav.tsx` | Staff sidebar tree. Role gating lives in `src/lib/sidebar-nav.ts` |
| `src/app/student/` | Student portal |
| `src/app/platform/` | Platform admin: tenants, users, memberships |
| `src/app/api/auth/` | NextAuth route handler |
| `src/apis/` | API functions + query hooks (platform / tenanted) |
| `src/features/<domain>/` | Feature UI components (many are still placeholders) |
| `src/components/ui/` | shadcn components (`components.json`) |
| `src/components/` | Shared app components (data table, confirm dialog, theme toggle, …) |
| `src/lib/` | Tenant resolution, API clients, utils |

The path alias `~/*` maps to `src/*`.

## Stack

| Area | Packages |
|------|----------|
| Framework | Next.js 16 (App Router, React Compiler enabled), React 19 |
| Auth | NextAuth (Auth.js) v5 |
| Styling | Tailwind CSS v4, `tailwind-merge`, `tw-animate-css`, `next-themes` |
| UI | shadcn/ui on Radix primitives, Lucide icons, Ant Design, Sonner, Recharts, DnD Kit |
| Data | TanStack Query, TanStack Table, axios |
| Validation | Zod |

See `package.json` for exact versions.

## Notes

- `next.config.ts` sets `allowedDevOrigins` to `lvh.me` and `*.lvh.me`. Without it, HMR and client chunks are blocked on tenant subdomains and pages don't hydrate.
- Docs: [PRD](../doc/prd.md), [repository README](../README.md), [backend README](../backend/README.md).
