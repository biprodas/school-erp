# Domains, routing and sign-in

| Field   | Value                                     |
| ------- | ----------------------------------------- |
| Status  | Draft (design accepted, not implemented)  |
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
| `/activate`   | Invited users               | Set password from an invite link or OTP                     |
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

1. **"Enter your email or phone"** (primary). We send a message listing the schools where that account has an active membership, each with a sign-in link. The response is the same whether or not the account exists ("If you have an account, we've sent you a link"), so it can't be used to discover accounts. Rate-limited per IP and per recipient.
2. **"Enter your school's address"**: a `____.mydomain.com` input that checks the slug and redirects.
3. **Directory search** (optional, P1): only schools that opt in are listed; minimum 3 characters; returns name, logo, district and URL only; rate-limited.

---

## 4. Signup and onboarding

```
mydomain.com/signup ──► verify email + SMS OTP ──► provision org (one transaction)
        ──► redirect to acme.mydomain.com/auth/handoff?code=… ──► /onboarding ──► /dashboard
```

1. On `mydomain.com/signup` the owner enters the school name, type, slug, owner name, email and phone.
2. Email link and SMS OTP verification. The org is not created until both pass, so unverified signups don't consume slugs.
3. `OrganizationService` creates the org, seeds system roles and provisions the owner (OWNER membership, `isAdmin`) in one transaction.
4. The owner is sent to the school host with a one-time handoff code (section 5) and lands on `/onboarding` already signed in.
5. **Onboarding gate**: `organizations.onboarding_completed_at` is null until the owner finishes or explicitly skips the required wizard steps. While it is null, `proxy.ts` sends school admins to `/onboarding` and shows other signed-in users a "Your school is being set up" page.
6. Invited staff, students and guardians activate on the school host (`/activate`), set a password, complete a short profile step on first sign-in, then land on `/dashboard` or `/student`.

---

## 5. Sessions and cross-host handoff

**Session cookies are host-only.** Each school host (subdomain or custom domain) has its own session cookie with no `Domain` attribute. Reasons:

- Browsers cannot share cookies between `mydomain.com` and `acme-scl.com`, so a shared parent-domain cookie can never cover custom domains.
- A shared `*.mydomain.com` cookie means signing in to school B replaces the session for school A. A teacher who works at two schools, or a guardian with children at two schools, would keep getting signed out.
- If schools ever publish their own content on their host, a parent-domain cookie would be exposed to it.

This replaces the current `AUTH_COOKIE_DOMAIN` behavior (one cookie shared across subdomains).

**Moving between hosts uses a one-time handoff code**, the same way Slack does:

1. The source host (for example `mydomain.com` after signup, or the "Find your school" email link) asks the backend for a handoff code for `(userId, orgId, targetHost)`.
2. The code is random, single-use, valid for 60 seconds, and bound to the target host and org. Only its hash is stored (`auth_tokens`, type `handoff`).
3. The browser is redirected to `https://<targetHost>/auth/handoff?code=…`.
4. The target host exchanges the code (server-side) for a normal tenant session and sets its own host-only cookie, then redirects to the intended path. Codes that are reused, expired or used on another host are rejected.

This works the same for subdomains and custom domains.

**Platform admin** lives on `admin.mydomain.com` with its own host-only cookie, separate from the marketing site and from every school. It can be further restricted (IP allowlist, mandatory 2FA) without affecting schools.

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

These are platform tables read before a tenant is known, so they are **not** `OrgScopedEntity` and not under RLS. They are read through the root connection, the same way as `organizations`.

---

## 9. Implementation checklist

Backend:

- [ ] Migration: `organization_domains`, `organization_slug_history`, `organizations.onboarding_completed_at`, `organizations.listed_in_directory`; migrate existing `organizations.domain` values into `organization_domains`, then drop the column.
- [ ] Shared reserved-slug list and slug validation on signup and rename.
- [ ] `TenantMiddleware` and `/public/organizations/resolve` read `organization_domains`; slug-history lookups return a redirect target.
- [ ] Handoff codes: issue (`auth_tokens` type `handoff`) and exchange endpoints.
- [ ] "Find your school" endpoint (email/phone → message with sign-in links), rate-limited, uniform response.
- [ ] Domain settings endpoints (add, verify, set primary, remove) gated by a plan entitlement, plus the DNS check job.
- [ ] TLS "ask" endpoint (if Caddy is used).
- [ ] Exclude the new public routes from `TenantMiddleware` in `app.module.ts`.

Frontend:

- [ ] Drop `AUTH_COOKIE_DOMAIN`; session cookies are host-only.
- [ ] `/auth/handoff` page and the redirect after signup.
- [ ] `/api/*` rewrite to the backend; browser client uses relative `/api`.
- [ ] Onboarding gate in `proxy.ts`.
- [ ] Move platform admin UI to `admin.<root>`; apex serves marketing only.
- [ ] Settings → Domain screen with DNS instructions and status.
- [ ] Primary-domain redirect for the subdomain.

Tests (PRD 11):

- [ ] Tenant resolution for subdomain, custom domain, inactive domain, old slug, reserved slug.
- [ ] Handoff code: single use, expiry, wrong host, wrong org.
- [ ] A session from one school host is not accepted on another.
- [ ] A domain cannot be claimed without the TXT record, and an unverified host gets no certificate.
- [ ] "Find your school" response does not reveal whether an account exists.
