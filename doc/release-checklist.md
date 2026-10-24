# Release checklist

Every production release must meet the PRD 11.5 criteria. This file maps each criterion, and the PRD 11.4 security tests, to the suite or check that proves it. CI (`.github/workflows/ci.yml`) runs the automated rows on every PR and on every push to `main`. The manual rows are signed off in the release ticket.

## PRD 11.5 release criteria

| Criterion | How it is checked | Automated |
| --- | --- | --- |
| No open critical security issues | `npm audit --omit=dev --audit-level=high` (CI step). Security tests below. The issue tracker has no open `security` issue at P0/P1 | CI + manual |
| Tenant isolation suite passes at 100% | `npm run test:release` (unit tests tagged `[tenant-isolation]`) and the e2e tests tagged `[tenant-isolation]` | CI |
| GPA regression suite passes at 100% | `npm run test:release`: `modules/grading/engine/engine.spec.ts` `[gpa-regression]` | CI |
| Fee regression suite passes at 100% | `npm run test:release`: `modules/fees/domain/fee-math.spec.ts` `[fee-regression]`; e2e `test/fees.e2e-spec.ts` | CI |
| End-to-end tests for the core workflows pass | `npm run test:e2e`: signup, onboarding, academic structure, students, attendance, exams and results, fees, portal and notices, security | CI |
| Migrations tested against a copy of production data | Restore drill (`doc/operations.md` §3), then `npm run db:migrate` and the e2e suite against the copy | Manual, per release |
| A backup restore has been tested | Restore drill logged in `doc/operations.md` §3, at least quarterly and before each major release | Manual |
| Monitoring and error alerting are active | `SENTRY_DSN` and `METRICS_TOKEN` set in production; a test event reaches Sentry; Prometheus is scraping `/api/metrics`; the alert rules in `doc/operations.md` §1 are enabled | Manual, per release |

## PRD 11.4 security tests

| Test | Where |
| --- | --- |
| Cross-tenant access: changed ids in URLs and bodies, forged `x-tenant-id`, a token from another school | `test/tenant-isolation.e2e-spec.ts`, `test/security.e2e-spec.ts`, plus each module's `[tenant-isolation]` e2e test (attendance, exams, fees, settings, audit log, numbering, portal) |
| Platform tokens on school APIs and school tokens on platform APIs | `test/security.e2e-spec.ts` ("keeps platform and school tokens in their own realm"), `test/membership.e2e-spec.ts`, `PlatformJwtStrategy` / `JwtStrategy` specs |
| Role escalation and permission bypass | `modules/rbac/services/role.service.spec.ts` ("no escalation"), `test/membership.e2e-spec.ts`, scoped-teacher e2e tests (`academic-structure`, `student-information`) |
| IDOR on students, invoices, documents and exports | `test/security.e2e-spec.ts` (students, documents, downloads, jobs and exports), `test/fees.e2e-spec.ts` (invoices and receipts), `test/portal-communication.e2e-spec.ts` (a guardian sees only their own children) |
| Gateway webhook forgery and replay | Phase 1b (online payments are not in 1a) |
| Session expiry and revocation | `test/auth-sessions.e2e-spec.ts` (refresh rotation and reuse, logout), `test/membership.e2e-spec.ts` (demoted or removed members are signed out) |
| A session or handoff code replayed on another school's host, reused or expired | `test/handoff.e2e-spec.ts`, `test/auth-sessions.e2e-spec.ts` |
| Claiming a custom domain without the TXT record; certificates for unverified hosts | `test/organization-domain.e2e-spec.ts`, `test/domain-settings.e2e-spec.ts` |
| Account enumeration through "Find your school", signup and password reset | `test/onboarding.e2e-spec.ts`, `test/signup.e2e-spec.ts` (same answer for known and unknown emails) |
| Malicious file uploads | `test/security.e2e-spec.ts` (sniffed type and size limits), `modules/files/file.service.spec.ts` |
| Abuse of bulk actions, OTP sending and rate-limited endpoints | `common/throttling/upload-throttle.spec.ts` (every upload handler is throttled), `AUTH_THROTTLE` / `PUBLIC_LOOKUP_THROTTLE` on login, signup, find-school and slug checks. OTP sending is Phase 1b |
| Secure headers | `test/security.e2e-spec.ts` (helmet headers, `Cache-Control: no-store`, no `X-Powered-By`) |

## Performance targets

Measured on the 5,000-student performance seed (`npm run perf:seed`, backend plan M8).

| Target | Check |
| --- | --- |
| Dashboards load in under 2 s | `perf:seed` timing table |
| Saving attendance for 50 students takes under 1 s | `perf:seed` timing table |
| 500 report cards render in under 2 minutes | `perf:seed` timing table. 91–97 s on 4 cores (2026-10-24), so re-check on the production instance size |

## Sign-off

- [ ] CI green on the release commit.
- [ ] Restore drill and migration rehearsal done within the last quarter (date: ____).
- [ ] Monitoring and alerting checked after deploy.
- [ ] No open P0/P1 security issues.
