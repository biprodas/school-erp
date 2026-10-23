# Domains, routing and sign-in

| Field   | Value                                     |
| ------- | ----------------------------------------- |
| Status  | Draft (design accepted; sessions and handoff implemented) |
| Date    | 2026-10-18                                |
| Related | `prd.md` 5.1, 6.2, 6.3, 6.24, 7.1, 8.1, 11 |

This document covers how users reach the product, how a school is found, where sign-in happens, and how schools map their own domain. `prd.md` holds the requirements. This document holds the design behind them.

---

## 1. Host map

Every school host serves **the same route tree**. A subdomain and a custom domain are two names for one school, and no code branches on which name was used.

| Host                         | Serves                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `mydomain.com`               | Marketing site, "Create your school", "Find your school"               |
| `admin.mydomain.com`         | Platform admin (super-admin, support, sales, finance)                  |
| `api.mydomain.com`           | Backend API. Browsers reach it through the same-origin proxy (section 6) |
| `<slug>.mydomain.com`        | A school: `/` home, `/login`, `/activate`, `/onboarding`, `/dashboard`, `/student` |
| `erp.acme-scl.com` (custom)  | The same school app, served under the school's own domain              |
| `acme-scl.com` (school apex) | Not hosted by us in v1. It stays the school's own website              |

School route tree:

| Path          | Who                         | Notes                                                       |
| ------------- | --------------------------- | ----------------------------------------------------------- |
| `/`           | Public                      | School home: name, logo, contact, notices marked public, login button |
| `/login`      | Everyone                    | Staff, students and guardians share one login page          |
| `/activate`   | Invited users               | Set password from an invite link (SMS OTP from Phase 1b)    |
| `/onboarding` | Owner and school admins     | Setup wizard (PRD 6.2) until setup is complete              |
| `/dashboard`  | Staff                       | Staff dashboard                                             |
| `/student`    | Students and guardians      | Portal                                                      |
| `/auth/handoff` | Anyone arriving from another host | Exchanges a one-time code for a session (section 5)  |

---

## 2. Slugs

- The slug is the school's subdomain. It is human-readable (`acme`, `dhaka-ideal`), never a random short ID, because parents and teachers type it.
- Signup suggests a slug from the school name. The owner can edit it, and availability is checked live.
- Rules: 3–40 characters, `a-z`, `0-9` and `-`, must start and end with a letter or digit. Stored lower-case. Unique across all schools.
- **Reserved slugs** cannot be taken: `www`, `api`, `app`, `admin`, `platform`, `dashboard`, `auth`, `login`, `signup`, `account`, `mail`, `smtp`, `email`, `status`, `docs`, `help`, `support`, `blog`, `static`, `assets`, `cdn`, `media`, `files`, `billing`, `pay`, `payments`, `dev`, `staging`, `test`, `demo`, `schools`. The list lives in one shared place (backend validation and frontend `lib/tenant.ts` read the same values).
- The internal identifier stays the organization UUID. The slug is only an address.
- **Renaming**: a school admin may change the slug (rate-limited, for example once per 30 days). Old slugs are kept in `organization_slug_history` and 301-redirect to the current one for at least 12 months, and they cannot be claimed by another school during that time.

---

## 3. Finding a school

An open search by school name would let anyone list every customer, so it is not the primary path.

1. **"Enter your email"** (primary; phone is accepted from Phase 1b, when SMS is available). We send a message listing the schools where that account has an active membership, each with a sign-in link. The response is the same whether or not the account exists ("If you have an account, we've sent you a link"), so it can't be used to discover accounts. Rate-limited per IP and per recipient.
2. **"Enter your school's address"**: a `____.mydomain.com` input that checks the slug and redirects.
3. **Directory search** (optional, P1): only schools that opt in are listed; minimum 3 characters; returns name, logo, district and URL only; rate-limited.

---

## 4. Signup and onboarding

```
mydomain.com/signup ──► verify email (+ SMS OTP from 1b) ──► provision org (one transaction)
        ──► redirect to acme.mydomain.com/auth/handoff?code=… ──► /onboarding ──► /dashboard
```

1. On `mydomain.com/signup` the owner enters the school name, type, slug, owner name, email and phone.
2. Email link verification (Phase 1a). Phase 1b adds an SMS OTP for the owner's phone. The org is not created until every required check passes, so unverified signups don't consume slugs.
3. `OrganizationService` creates the org, seeds system roles and provisions the owner (OWNER membership, `isAdmin`) in one transaction.
4. The owner is sent to the school host with a one-time handoff code (section 5) and lands on `/onboarding` already signed in.
5. **Onboarding gate**: `organizations.onboarding_completed_at` is null until the owner finishes or explicitly skips the required wizard steps. While it is null, `proxy.ts` sends school admins to `/onboarding` and shows other signed-in users a "Your school is being set up" page.
6. Invited staff, students and guardians activate on the school host (`/activate`) from an invite link, or sign in with a printed credential slip (email or phone + temporary password), set a password, complete a short profile step on first sign-in, then land on `/dashboard` or `/student`.

---

## 5. Sessions and cross-host handoff

**Session cookies are host-only.** Each school host (subdomain or custom domain) has its own session cookie with no `Domain` attribute. Reasons:

- Browsers cannot share cookies between `mydomain.com` and `acme-scl.com`, so a shared parent-domain cookie can never cover custom domains.
- A shared `*.mydomain.com` cookie means signing in to school B replaces the session for school A. A teacher who works at two schools, or a guardian with children at two schools, would keep getting signed out.
- If schools ever publish their own content on their host, a parent-domain cookie would be exposed to it.

This replaces the current `AUTH_COOKIE_DOMAIN` behavior (one cookie shared across subdomains).

**Moving between hosts uses a one-time handoff code**, the same way Slack does:

1. The source host (for example `mydomain.com` after signup, or the "Find your school" email link) asks the backend for a handoff code for `(userId, orgId)`: `POST /platform/auth/handoff { orgId }` with a platform session. It is refused (403, same answer in every case) unless the account, the school and the membership are all active.
2. The code is random, single-use, valid for 60 seconds, and bound to the target school (`auth_tokens.org_id`). Only its hash is stored (`auth_tokens`, type `handoff`).
3. The browser is redirected to `https://<school host>/auth/handoff?code=…&next=/dashboard`.
4. That host's route handler (`frontend/src/app/auth/handoff/route.ts`) redeems the code server-side (`POST /auth/handoff` with the school's `x-tenant-id`) for a normal tenant session, sets its own host-only cookie, and redirects to `next` (same-host paths only). Codes that are reused, expired or redeemed by another school are rejected, and the user lands on `/login?error=handoff`. Redemption is atomic (`UPDATE … WHERE used_at IS NULL`), so two concurrent requests can't both use one code.

The code is bound to the school, not to one hostname, so it works the same on the school's subdomain and its custom domain.

**Platform admin** lives on `admin.mydomain.com` with its own host-only cookie, separate from the marketing site and from every school. It can be further restricted (IP allowlist, mandatory 2FA) without affecting schools.

---

## 5a. Google sign-in

Google only accepts redirect URLs registered in advance, and we have one host per school plus custom domains. So every Google sign-in, from any host, goes through **one fixed callback on the product domain** and then returns to the starting host with a handoff code (section 5). Schools and custom domains need no Google configuration.

```
acme.mydomain.com/login ──► mydomain.com/api/oauth/google/start?return=acme.mydomain.com&next=/dashboard
        ──► accounts.google.com (state + PKCE + nonce)
        ──► mydomain.com/api/oauth/google/callback
        ──► acme.mydomain.com/auth/handoff?code=…&next=/dashboard ──► signed in on acme
```

1. **Start** (`GET /oauth/google/start`, platform route): `return` must be a school host we serve (a subdomain of the root domain, or a `verified`/`active` custom domain) or the platform admin host; anything else is refused, so this can't be used as an open redirect. The backend stores a single-use state (10 minutes) with the PKCE verifier, a nonce, the return host, the school it resolves to, `next` (same-host path only) and the intent (`signin`, `signup` or `link`), then redirects to Google with `scope=openid email profile`, `prompt=select_account`.
2. **Callback** (`GET /oauth/google/callback`): consume the state (single use), exchange the code with the PKCE verifier, and verify the ID token (issuer, audience, expiry, nonce) and `email_verified = true`. Google access and refresh tokens are not stored; only the Google subject id and email are.
3. **Find the account:** by linked identity (`user_identities.provider = 'google'` and `subject`), else by the verified email, in which case the identity is linked now and the account's email is marked verified (Google has proved control of that address). No match:
   - school sign-in: the user lands on that school's `/login?error=google_no_account`, with the same message whether or not an account exists elsewhere;
   - signup on the product domain: the signup form continues with the verified email, and no email link is needed.
4. **Sign in:** for a school, the same checks as a password login (account status, ACTIVE membership in that school, lockout does not apply), then a handoff code for that school and a redirect to `https://<return host>/auth/handoff?code=…&next=…`. For the platform admin host, a platform handoff code redeemed at `admin.mydomain.com/auth/handoff`.
5. **Link / unlink** (account settings, signed in): `start?intent=link` binds the state to the signed-in user; the callback links the Google identity unless it already belongs to another account. Unlinking requires a password on the account, so nobody loses their only way in.

**Never creates memberships.** Google sign-in only signs people in to schools that already added them (invite, import, staff directory). Restricting a school to its Google Workspace domain (`hd`) can come later as a school setting.

**Data:** `user_identities (user_id, provider, subject, email, linked_at, last_used_at)`, unique on `(provider, subject)`; `oauth_states (state_hash, code_verifier, nonce, return_host, org_id, next, intent, user_id, expires_at, used_at)`. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the callback URL derived from `APP_URL`.

---

## 6. API access: same-origin proxy

Browsers call `/api/*` on the host they are on. The Next.js app rewrites those requests to the backend and forwards the tenant (`x-tenant-id` resolved from the host, plus `X-Forwarded-Host`).

- No CORS configuration per custom domain. `CORS_ORIGIN` only needs the platform hosts.
- The backend still resolves the tenant from `x-tenant-id`, then subdomain, then custom domain (`TenantMiddleware`), and `JwtStrategy` still rejects a token whose `orgId` differs from the resolved org.
- Server components and server actions keep calling the backend directly (`lib/api/server.ts`).

---

## 7. Custom domains

Available on Standard and higher plans (PRD 3.3).

**Scope (v1):** the school maps an **app host** such as `erp.acme-scl.com` or `app.acme-scl.com`. The apex `acme-scl.com` stays the school's own website:

- An apex cannot hold a CNAME, so it needs A records to our IPs, which ties customers to our infrastructure.
- Most schools already have a website on their apex.
- Hosting the school website (a page builder or CMS) is a separate product, considered for a later phase. Until then, the school links "Login" on its own website to `erp.acme-scl.com/login`.

**Setup flow** (Settings → Domain):

1. The admin enters `erp.acme-scl.com`. We validate it (a subdomain of a domain they control, not under `mydomain.com`, not already claimed).
2. We show two DNS records:
   - `CNAME erp.acme-scl.com → schools.mydomain.com`
   - `TXT _school-verify.erp.acme-scl.com → <verification token>` (proves ownership)
3. A background job checks DNS (on demand and every few minutes for 72 hours). When both records resolve, the domain becomes `verified`.
4. A TLS certificate is issued automatically (see below). When it is live, the domain becomes `active`.
5. The admin may mark it **primary**. Then `acme.mydomain.com` 301-redirects to it, except `/auth/handoff` and the platform health path. The subdomain always keeps working, so a school with broken DNS can still sign in.
6. Removing a domain or failing DNS re-checks (for example 7 days of failure) marks it `inactive`, and traffic falls back to the subdomain.

**TLS:** one of the following, chosen at deployment time:

- **Cloudflare for SaaS (Custom Hostnames)**: Cloudflare issues and renews certificates and fronts the traffic. Least operational work.
- **Caddy on-demand TLS**: Caddy issues a Let's Encrypt certificate on the first request for a host, after calling an internal "ask" endpoint that returns 200 only for `active`/`verified` domains in our DB. This prevents certificate issuance for arbitrary hostnames.

**Tenant resolution:** `TenantMiddleware` and `lib/tenant.ts` look the host up in `organization_domains` (only `verified`/`active` rows), with the existing in-memory caches. A domain change invalidates the cache.

---

## 8. Data model changes

Replace `organizations.domain` with a table, and add the onboarding flag and slug history.

```prisma
model OrganizationDomain {
  @@map("organization_domains")
  id                String    // uuid
  orgId             String    // FK → organizations, cascade
  hostname          String    // lower-case, unique across all schools
  isPrimary         Boolean   // at most one per org (partial unique index)
  status            String    // pending | verified | active | inactive
  verificationToken String
  verifiedAt        DateTime?
  tlsStatus         String    // pending | issued | failed
  lastCheckedAt     DateTime?
  createdAt         DateTime
  updatedAt         DateTime
}

model OrganizationSlugHistory {
  @@map("organization_slug_history")
  id        String   // uuid
  orgId     String   // FK → organizations, cascade
  slug      String   // unique; cannot be reused while present
  createdAt DateTime
  expiresAt DateTime // 12 months after rename
}

// organizations: + onboardingCompletedAt DateTime?, + listedInDirectory Boolean
```

**`organization_domains` (implemented, migration `OrganizationDomains`)** extends `OrgScopedEntity`, so it is under RLS and the app role has DML on it. That lets the school's own Settings → Domain screen use the normal tenant repositories. Resolving a host happens before any tenant is known, so `OrganizationService.findByDomain` reads it through the root connection, which bypasses RLS. Unlike other tenanted keys, `hostname` is unique across all schools. The migration moved each existing `organizations.domain` value in as primary, verified and active (lower-cased, trailing dot removed; on a clash the oldest school keeps the hostname), then dropped the column.

**`organization_slug_history`** is a platform table, read before a tenant is known, so it is not `OrgScopedEntity` and not under RLS. It is read through the root connection, like `organizations` (implemented in migration `PlatformAndOnboarding`; `rls.ts` leaves it out of RLS through `PLATFORM_TABLES_WITH_ORG_ID`).

---

## 9. Implementation checklist

Backend:

- [x] Migration: `organization_domains` (with RLS and app-role grant), existing `organizations.domain` values moved in, column dropped.
- [x] Migration: `organization_slug_history`, `organizations.onboarding_completed_at`, `organizations.listed_in_directory` (`OrgSettings` and `PlatformAndOnboarding`).
- [x] Shared reserved-slug list and slug validation on signup and rename (`src/shared/slug/reserved-slugs.ts`, `GET /public/slugs/reserved`).
- [x] `TenantMiddleware` and `/public/organizations/resolve` read `organization_domains` (only `verified`/`active` domains resolve).
- [x] Slug-history lookups return a redirect target (410 `TENANT_MOVED` with `slug`; `by-slug` returns `movedFrom`).
- [x] Handoff codes: issue (`POST /platform/auth/handoff`, `auth_tokens` type `handoff`) and exchange (`POST /auth/handoff`) endpoints.
- [x] Google sign-in (section 5a): start/callback on the product domain, state + PKCE + nonce, return-host allow-list, account match by identity or verified email, school and platform handoff, link/unlink (`src/modules/oauth/`).
- [x] "Find your school" endpoint (`POST /public/find-school`; email → message with sign-in links; phone/SMS in Phase 1b), rate-limited, uniform response.
- [x] Domain settings endpoints at `/domains` (list, add, `:id/verify`, `:id/primary`, delete), permissions `domains:read` / `domains:manage`.
- [x] DNS check job (`DomainCheckScheduler`, every 5 minutes): pending domains for 72 hours, verified/active ones hourly; 7 days of failures → `inactive` (`dns_failing_since`).
- [x] Gate custom domains by plan (Standard+): adding, verifying and making primary need the `custom_domain` module.
- [ ] Mark a domain `active` (`tls_status = issued`) from the TLS provider's signal; today a verified domain already resolves and gets a certificate.
- [x] TLS "ask" endpoint: `GET /public/organizations/tls-check?domain=` (200 only for a verified/active domain of an active school).
- [x] Exclude the new public routes from `TenantMiddleware` in `app.module.ts` (`public/*` already was; `oauth/*` and `platform/plans` added).

Frontend:

- [x] Drop `AUTH_COOKIE_DOMAIN`; session cookies are host-only.
- [x] `/auth/handoff` route handler; platform "Open school" signs members in through it.
- [ ] Redirect to the school host with a handoff code after signup (needs the self-serve signup flow).
- [ ] `/api/*` rewrite to the backend; browser client uses relative `/api`.
- [ ] Onboarding gate in `proxy.ts`.
- [ ] Move platform admin UI to `admin.<root>`; apex serves marketing only.
- [ ] Settings → Domain screen with DNS instructions and status (API ready: each domain carries its `dnsRecords`).
- [ ] Primary-domain redirect for the subdomain.

Tests (PRD 11):

- [x] Custom-domain resolution: active vs pending, case/port normalization, hostname unique across schools, one primary per school, cascade on school delete (`test/organization-domain.e2e-spec.ts`).
- [x] Tenant resolution for an old slug (`test/slugs.e2e-spec.ts`). *Reserved slugs can't be created, so none resolves.*
- [x] Handoff code: single use, expiry, concurrent redemption, wrong org (`handoff.spec.ts`, `test/handoff.e2e-spec.ts`).
- [x] A session from one school host is not accepted on another (`JwtStrategy` org binding, `tenant-isolation.e2e-spec.ts`).
- [x] A domain cannot be claimed without the TXT record, and an unverified host gets no certificate (`test/domain-settings.e2e-spec.ts`).
- [x] "Find your school" response does not reveal whether an account exists (`test/onboarding.e2e-spec.ts`).
